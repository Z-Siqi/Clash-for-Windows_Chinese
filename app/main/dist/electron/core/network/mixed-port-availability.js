"use strict";

const { parsePort } = require("./tcp-port");

function mixedPortHost(config, isIP) {
    if (!config["allow-lan"]) return "127.0.0.1";
    const address = config["bind-address"] || "*";
    // Both packaged cores use a dual-stack Go listener for IPv4 wildcards.
    if (["*", "0.0.0.0", "[::]"].includes(address)) return "::";
    if (address === "localhost") return "127.0.0.1";
    if (isIP(address) === 4) return address;
    if (address.startsWith("[") && address.endsWith("]") && isIP(address.slice(1, -1)) === 6) return address.slice(1, -1);
    // Preserve custom hostname resolution and legacy bind syntax. A separate
    // preflight lookup could choose a different address from the core's lookup.
    return null;
}

async function isMixedPortAvailable({ net, dgram, port, config, permissionMayDiffer = false }) {
    port = parsePort(port);
    if (port === null) return false;
    const host = mixedPortHost(config, net.isIP);
    if (host === null) return null;
    async function probe(address) {
        const tcp = net.createServer();
        let udp;
        try {
            await new Promise((resolve, reject) => {
                tcp.once("error", reject);
                tcp.listen({ host: address, port, exclusive: true, ipv6Only: false }, resolve);
            });
            udp = dgram.createSocket({ type: net.isIP(address) === 6 ? "udp6" : "udp4", reuseAddr: false, ipv6Only: false });
            await new Promise((resolve, reject) => {
                udp.once("error", reject);
                udp.bind({ address, port, exclusive: true }, resolve);
            });
            return true;
        } finally {
            // Hold both protocols until the check completes, then release only
            // these temporary sockets. No application listener is touched.
            await Promise.all([tcp, udp].filter(Boolean).map(socket => new Promise(resolve => {
                try { socket.close(() => resolve()); } catch { resolve(); }
            })));
        }
    }
    try { return await probe(host); }
    catch (error) {
        if (host === "::" && ["EAFNOSUPPORT", "EADDRNOTAVAIL", "EPROTONOSUPPORT"].includes(error.code)) {
            try { return await probe("0.0.0.0"); }
            catch (fallbackError) { error = fallbackError; }
        }
        // A Unix Service Mode core may bind privileged ports that its desktop
        // process cannot. Keep permission failures inconclusive in that case.
        if (error.code === "EACCES" && permissionMayDiffer) return null;
        if (["EADDRINUSE", "EACCES"].includes(error.code)) return false;
        throw error;
    }
}

module.exports = { isMixedPortAvailable, mixedPortHost };
