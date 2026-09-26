"use strict";

const { prepareProfile } = require("./prepare-profile");

function dnsHijackAddresses(hijacks = []) {
    return hijacks.reduce((addresses, value) => {
        const [host, port] = value.split(":");
        if (port === "53" || port === undefined) {
            if (host === "any") addresses.push("8.8.8.8");
            else if (/\d+\.\d+\.\d+\.\d+/.test(host)) addresses.push(host);
        }
        return addresses;
    }, []);
}

function createProfileApplication(deps) {
    const { fs, path, yaml, platform, clashApi, effects, messages } = deps;
    return async function applyProfile(input) {
        const { profiles, profilesPath } = input;
        const confData = input.confData || {};
        if (!(profiles.index >= 0)) {
            await effects.stopTap();
            return { success: false, message: null };
        }
        let success = false;
        let message = null;
        try {
            const profile = profiles.files[profiles.index];
            if (!profile) throw new Error("Selected profile does not exist");
            const source = fs.readFileSync(path.join(profilesPath, profile.time), "utf8");
            const { config, hasProviders } = await prepareProfile({ ...input, source, profile }, deps);
            const tun = config.tun || {};
            const dns = config.dns || {};
            const autoDetect = tun["auto-detect-interface"] || tun["macOS-auto-detect-interface"];
            let needsTap = false;
            if (platform !== "linux" && tun.enable && !autoDetect && !config["interface-name"]) {
                config["interface-name"] = effects.detectInterface();
                if (!config["interface-name"]) return { success: false, message: messages.tunInterface };
            }
            if (platform === "win32" && !tun.enable && effects.hasTap() && dns.enable && dns.listen) {
                const [host, port] = dns.listen.split(":").map(value => value.trim());
                needsTap = ["", "0.0.0.0"].includes(host) && port === "53";
                if (needsTap && !config["interface-name"] && !tun["auto-detect-interface"]) {
                    config["interface-name"] = effects.detectInterface();
                    if (!config["interface-name"]) return { success: false, message: messages.tapInterface };
                }
            }
            const response = await clashApi.putConfig({
                payload: yaml.stringify({ ...config, ipv6: confData.ipv6, "log-level": confData["log-level"] })
            }, { validateStatus: () => true, timeout: hasProviders ? 0 : 10000 });
            success = response.status === 204;
            message = response.data && response.data.message || `Switching profile failed with status: ${response.status}`;
            if (!success) {
                effects.setPayload({});
                return { success, message };
            }
            effects.setPayload(config);
            effects.setProvidersVisible(hasProviders);
            if (tun.enable) {
                const addresses = dnsHijackAddresses(tun["dns-hijack"]);
                if (addresses.length) {
                    try { effects.setDns(addresses); effects.setDnsChanged(true); }
                    catch (_error) { effects.setDnsChanged(false); }
                }
                if (platform === "win32" && tun.stack === "system") effects.renewDhcp();
            } else effects.resetDns();
            if (profile.selected) {
                // A stale group must not prevent the remaining groups or mode from restoring.
                await Promise.allSettled(profile.selected.map(({ name, now }) => clashApi.selectProxy(name, now)));
            }
            if (profile.mode) await effects.switchMode(profile.mode);
            if (needsTap) await effects.startTap();
            else await effects.stopTap();
            return { success: true, message: null };
        } catch (error) {
            const position = error.linePos && error.linePos.start;
            const location = position ? `, on line: ${position.line}, at column: ${position.col}` : "";
            return { success: false, message: `Error: ${error.message}${location}` };
        }
    };
}

module.exports = { createProfileApplication, dnsHijackAddresses };
