"use strict";

const { clientIdentity } = require("./dhcp-policy");
const { createHash } = require("crypto");

function policyIdentity(client) {
    const value = clientIdentity(client);
    if (typeof value !== "string") return undefined;
    return value.length <= 128 ? { kind: "raw", value }
        : { kind: "sha256", value: createHash("sha256").update("cfw-dhcp-client\0").update(value).digest("hex") };
}

function registerDhcpIpc({ ipcMain, app, getMainWindow, dhcp, networkInterfaces, isIPv4, powerSaveBlocker }) {
    let active;
    function send(owner, type, value) {
        if (!owner.isDestroyed()) owner.send("dhcp-event", { type, value });
    }
    function stop() {
        const previous = active;
        active = undefined;
        if (!previous) return;
        clearTimeout(previous.timer);
        if (previous.blocker !== undefined) powerSaveBlocker.stop(previous.blocker);
        try { previous.server.close(); } catch { /* A failed bind may already have closed the socket. */ }
        previous.reject?.(new Error("DHCP startup was cancelled"));
        send(previous.owner, "close");
    }
    function addresses(value, limit) {
        if (!Array.isArray(value) || value.length > limit || value.some(item => typeof item !== "string" || item.length > 128)) throw new Error("Invalid DHCP policy");
        return [...new Set(value)];
    }
    function policy(request) {
        const hijacked = addresses(request.hijackAddresses || [], 2048);
        const tokens = addresses(request.hijackIdentityTokens || [], 2048);
        if (tokens.some(value => !/^[a-f0-9]{64}$/.test(value)) || hijacked.length + tokens.length > 2048) throw new Error("Invalid DHCP policy");
        const dns = addresses(request.hijackDns || [], 2).filter(isIPv4);
        return { hijacked, tokens, dns };
    }
    function validate(config) {
        const fields = ["localAddress", "rangeFrom", "rangeTo", "netmask", "defaultRouter", "primaryDns", "broadAddress"];
        if (!config || fields.some(key => typeof config[key] !== "string" || !isIPv4(config[key])) ||
            (config.secondlyDns !== "" && !isIPv4(config.secondlyDns))) throw new Error("Invalid DHCP configuration");
        if (!Object.values(networkInterfaces()).flat().some(item => item && !item.internal && item.address === config.localAddress)) throw new Error("DHCP interface is unavailable");
        const number = address => address.split(".").reduce((result, item) => (result * 256 + Number(item)) >>> 0, 0);
        const mask = number(config.netmask);
        const inverse = (~mask) >>> 0;
        if (!inverse || inverse > 0x7fffffff || (inverse & (inverse + 1)) !== 0) throw new Error("Invalid DHCP subnet mask");
        const local = number(config.localAddress);
        const subnet = (local & mask) >>> 0;
        const broadcast = (subnet | inverse) >>> 0;
        const from = number(config.rangeFrom), to = number(config.rangeTo);
        if (from <= subnet || to >= broadcast || from > to || (from & mask) >>> 0 !== subnet ||
            (to & mask) >>> 0 !== subnet || (local >= from && local <= to) ||
            number(config.broadAddress) !== broadcast || ((number(config.defaultRouter) & mask) >>> 0) !== subnet) throw new Error("Invalid DHCP address range");
        return config;
    }
    app.on?.("before-quit", stop);
    const observed = new WeakSet();
    ipcMain.handle("dhcp", async (event, operation, request = {}) => {
        const owner = getMainWindow()?.webContents;
        if (!owner || owner !== event.sender || owner.mainFrame !== event.senderFrame) throw new Error("Unauthorized DHCP request");
        if (operation === "stop") { stop(); return; }
        if (operation === "policy") {
            const next = policy(request);
            if (active) active.policy = next;
            return;
        }
        if (operation !== "start" || active) throw new Error("DHCP operation is unavailable");
        const config = validate(request.config);
        const selectedPolicy = policy(request);
        if (!observed.has(owner)) {
            observed.add(owner);
            owner.once("destroyed", stop);
            owner.on("did-start-loading", stop);
        }
        const job = { owner, policy: selectedPolicy, leaseOwners: new Map(), currentLeaseKeys: new Map() };
        const isHijacked = client => {
            const identity = policyIdentity(client);
            return !!identity && (identity.kind === "raw" ? job.policy.hijacked : job.policy.tokens).includes(identity.value);
        };
        // A fixed DHCP port is required for broadcasts; callers cannot choose a socket or native command.
        job.server = dhcp.createServer({
            range: [config.rangeFrom, config.rangeTo], forceOptions: ["hostname"], randomIP: true, static: {},
            netmask: config.netmask, broadcast: config.broadAddress, server: config.localAddress,
            router: client => [isHijacked(client) ? config.localAddress : config.defaultRouter],
            dns: client => isHijacked(client)
                ? (job.policy.dns.length ? job.policy.dns : [config.localAddress])
                : [config.primaryDns, config.secondlyDns].filter(Boolean),
            maxMessageSize: 1500, leaseTime: 86400, renewalTime: 60, rebindingTime: 120, bootFile: "", hostname: "cfw"
        });
        active = job;
        const clients = new Map();
        job.server.on("message", client => {
            if (active !== job || typeof client.chaddr !== "string" || client.chaddr.length > 128 || (!clients.has(client.chaddr) && clients.size >= 2048)) return;
            // dhcp 1.x keys leases by encoded option 61, while the UI identifies clients by MAC.
            const identity = typeof client.options?.[61] === "string"
                ? `client-id:${Buffer.from(client.options[61]).toString("base64url")}`
                : client.chaddr.replace(/:/g, "-").toUpperCase();
            const key = client.giaddr && client.giaddr !== "0.0.0.0" ? `relay:${client.giaddr}:${identity}` : identity;
            job.currentLeaseKeys.set(client.chaddr, key);
            job.leaseOwners.set(key, client.chaddr);
            // Retain old client-ID leases, but bound identity churn while
            // protecting every currently observed client's lease mapping.
            if (job.leaseOwners.size > 4096) {
                const currentKeys = new Set(job.currentLeaseKeys.values());
                for (const previousKey of job.leaseOwners.keys()) {
                    if (!currentKeys.has(previousKey)) { job.leaseOwners.delete(previousKey); break; }
                }
            }
            const options = {};
            for (const key of [12, 61]) if (typeof client.options?.[key] === "string") options[key] = client.options[key].slice(0, 128);
            const value = { chaddr: client.chaddr, options, policyIdentity: policyIdentity(client) };
            const projection = JSON.stringify(value);
            if (clients.get(client.chaddr) !== projection) {
                clients.set(client.chaddr, projection);
                send(owner, "message", value);
            }
        });
        job.server.on("bound", value => {
            if (active !== job) return;
            const result = {};
            let count = 0;
            // A MAC can retain old client-ID leases. Prefer its current identity
            // regardless of the snapshot order, and publish each row only once.
            for (const [mac, key] of job.currentLeaseKeys) {
                if (job.leaseOwners.get(key) === mac && Object.hasOwn(value || {}, key) && isIPv4(value[key]?.address)) {
                    Object.defineProperty(result, mac, { enumerable: true, value: { address: value[key].address } });
                    count++;
                }
            }
            for (const [key, lease] of Object.entries(value || {}).slice(0, 2048)) {
                if (count >= 2048) break;
                const mac = job.leaseOwners.get(key) || (!/^(?:client-id:|relay:)/.test(key) ? key : null);
                if (mac && mac.length <= 128 && !Object.hasOwn(result, mac) && isIPv4(lease?.address)) {
                    Object.defineProperty(result, mac, { enumerable: true, value: { address: lease.address } });
                    count++;
                }
            }
            send(owner, "bound", result);
        });
        job.server.on("close", () => { if (active === job) stop(); });
        return new Promise((resolve, reject) => {
            job.reject = reject;
            job.server.on("error", () => {
                if (active !== job) return;
                send(owner, "error", "DHCP service is unavailable");
                stop();
            });
            job.server.once("listening", () => {
                if (active !== job) return;
                clearTimeout(job.timer);
                job.reject = undefined;
                job.blocker = powerSaveBlocker.start("prevent-app-suspension");
                resolve();
            });
            job.timer = setTimeout(stop, 10000);
            try { job.server.listen(67); } catch { stop(); }
        });
    });
}

module.exports = { registerDhcpIpc };
