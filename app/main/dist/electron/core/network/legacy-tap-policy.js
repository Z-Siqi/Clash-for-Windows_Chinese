"use strict";

const TAP_MODES = Object.freeze(["enabled", "mixin", "disabled"]);

function resolveTapMode(settings = {}) {
    if (TAP_MODES.includes(settings.legacyTapMode)) return settings.legacyTapMode;
    // The former default-on boolean cannot prove explicit permission for subscriptions.
    return settings.legacyTapEnabled === false ? "disabled" : "mixin";
}

function isTapDns(dns) {
    if (dns?.enable !== true || typeof dns.listen !== "string") return false;
    const [host, port, extra] = dns.listen.split(":").map(part => part.trim());
    return extra === undefined && ["", "0.0.0.0"].includes(host) && port === "53";
}

function allowsLegacyTap(settings, mixinAuthorized) {
    const mode = resolveTapMode(settings);
    return mode === "enabled" || (mode === "mixin" && mixinAuthorized === true);
}

module.exports = { TAP_MODES, resolveTapMode, isTapDns, allowsLegacyTap };
