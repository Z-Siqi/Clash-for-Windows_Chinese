"use strict";

const { prepareProfile } = require("./prepare-profile");
const { createTranslator } = require("../../core/i18n/language");
const { allowsLegacyTap, isTapDns } = require("../../core/network/legacy-tap-policy");

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
        const isCurrent = input.isCurrent || (() => true);
        const superseded = () => ({ success: false, message: null, superseded: true });
        if (!isCurrent()) return superseded();
        const startedAt = Date.now();
        let stage = "prepare";
        let stageStartedAt = startedAt;
        const reportTiming = (name, duration) => {
            // Diagnostics must never change the outcome of a configuration apply.
            try { deps.onTiming?.(name, duration); } catch (_error) {}
        };
        const nextStage = name => {
            reportTiming(stage, Date.now() - stageStartedAt);
            stage = name;
            stageStartedAt = Date.now();
        };
        const { profiles, profilesPath } = input;
        const confData = input.confData || {};
        if (!(profiles.index >= 0)) {
            await effects.stopTap();
            return { success: false, message: null };
        }
        let success = false;
        let message = null;
        let tapStarting = false;
        try {
            const profile = profiles.files[profiles.index];
            if (!profile) throw Object.assign(new Error("Selected profile does not exist"), { code: "CFW_PROFILE_MISSING" });
            const source = deps.readProfileSource ? await deps.readProfileSource(profilesPath, profile.time)
                : fs.readFileSync(path.join(profilesPath, profile.time), "utf8");
            if (!isCurrent()) return superseded();
            const { config, hasProviders, tapAuthorized } = await prepareProfile({ ...input, source, profile }, deps);
            if (!isCurrent()) return superseded();
            const tun = config.tun || {};
            const dns = config.dns || {};
            const autoDetect = tun["auto-detect-interface"] || tun["macOS-auto-detect-interface"];
            let needsTap = false;
            const tapEligible = platform === "win32" && allowsLegacyTap(input.settings, tapAuthorized) && !tun.enable && isTapDns(dns);
            if (platform !== "linux" && tun.enable && !autoDetect && !config["interface-name"]) {
                config["interface-name"] = await effects.detectInterface();
                if (!isCurrent()) return superseded();
                if (!config["interface-name"]) return { success: false, message: messages.tunInterface };
            }
            if (tapEligible) {
                needsTap = await effects.hasTap();
                if (!isCurrent()) return superseded();
                if (!config["interface-name"] && !tun["auto-detect-interface"]) {
                    let detected;
                    try { detected = await effects.detectInterface(); }
                    catch (error) { if (needsTap) throw error; }
                    if (!isCurrent()) return superseded();
                    if (detected) config["interface-name"] = detected;
                    else if (needsTap) return { success: false, message: messages.tapInterface };
                }
            }
            nextStage("core-config");
            const submitted = yaml.stringify({ ...config, ipv6: confData.ipv6, "log-level": confData["log-level"] });
            const response = await clashApi.putConfig({
                payload: submitted
            }, { validateStatus: () => true, timeout: hasProviders ? 0 : 10000 });
            nextStage("network-effects");
            success = response.status === 204;
            message = response.data && response.data.message || (deps.getLanguage?.() || createTranslator(1)).profileSwitchStatus({ status: response.status });
            if (success) effects.setPayload(config, { tapAuthorized, submitted });
            if (!isCurrent()) return superseded();
            if (!success) {
                return { success, message };
            }
            effects.setProvidersVisible(hasProviders);
            if (profile.selected) {
                // A stale group must not prevent the remaining groups or mode from restoring.
                await Promise.allSettled(profile.selected.map(({ name, now }) => clashApi.selectProxy(name, now)));
                if (!isCurrent()) return superseded();
            }
            if (profile.mode) await effects.switchMode(profile.mode);
            if (!isCurrent()) return superseded();
            if (tun.enable) {
                const addresses = dnsHijackAddresses(tun["dns-hijack"]);
                if (addresses.length) {
                    try { await effects.setDns(addresses); effects.setDnsChanged(true); }
                    catch (_error) { effects.setDnsChanged(false); }
                    if (!isCurrent()) return superseded();
                }
                if (platform === "win32" && tun.stack === "system") await effects.renewDhcp();
            } else await effects.resetDns();
            if (!isCurrent()) return superseded();
            if (needsTap) { tapStarting = true; await effects.startTap({ isCurrent, signal: input.signal }); }
            else await effects.stopTap();
            if (!isCurrent()) return superseded();
            return { success: true, message: null };
        } catch (error) {
            if (!isCurrent()) return superseded();
            const labels = deps.getLanguage?.() || createTranslator(1);
            const position = error.linePos?.[0] || error.linePos?.start;
            const location = position ? labels.profileErrorLocation({ line: position.line, column: position.col }) : "";
            const key = { CFW_PROFILE_NOT_MAPPING: "profileNotMapping", CFW_MIXIN_NOT_MAPPING: "mixinNotMapping", CFW_PROFILE_MISSING: "selectedProfileMissing" }[error.code];
            // Localize owned validation failures; keep third-party diagnostics intact.
            const reason = key ? labels[key]() : error.name === "YAMLParseError"
                ? `${labels.profileInvalidYaml()}\n\n${error.message}` : error.message;
            return { success: false, message: labels.profileApplyError({ reason, location }), ...(tapStarting ? { tapFailed: true, coreApplied: true } : {}) };
        } finally {
            reportTiming(stage, Date.now() - stageStartedAt);
            reportTiming("total", Date.now() - startedAt);
        }
    };
}

module.exports = { createProfileApplication, dnsHijackAddresses };
