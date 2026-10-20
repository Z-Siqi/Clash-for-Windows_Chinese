"use strict";

function equalValue(left, right) {
    if (left === right) return true;
    if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
    if (Array.isArray(left) !== Array.isArray(right)) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equalValue(left[key], right[key]));
}

// Read the last accepted payload; do not rewrite Mixin output or saved profiles.
function networkModeDiagnostics({ config = {}, tunRequested, tunConfig, systemProxyOn, tapActive }) {
    const warnings = [];
    const tunEnabled = !!config.tun?.enable;
    if (tunRequested && !tunEnabled) warnings.push("networkTunOverridden");
    else if (!tunRequested && tunEnabled) warnings.push("networkTunFromProfile");
    if (tunRequested && tunEnabled && tunConfig) {
        if (!equalValue(config.tun, tunConfig.tun)
            || (Object.hasOwn(tunConfig, "interface-name") && config["interface-name"] !== tunConfig["interface-name"])) {
            warnings.push("networkTunOptionsOverridden");
        }
        if (!equalValue(config.dns, tunConfig.dns)) warnings.push("networkDnsOverridden");
    }
    if (tunEnabled && !config.dns?.enable) warnings.push("networkTunDnsDisabled");
    if (tapActive) warnings.push("networkLegacyTapActive");
    if ((tunEnabled || tapActive) && systemProxyOn) warnings.push("networkBypassHint");
    if (config.dns?.enable && /^(?:0\.0\.0\.0)?:53$/.test(String(config.dns.listen || "").trim())) warnings.push("networkDnsListen53");
    return warnings;
}

module.exports = { networkModeDiagnostics };
