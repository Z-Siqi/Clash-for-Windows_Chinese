"use strict";

const { CORE_TYPES, normalizeCoreType } = require("./core-selection");

const ROUTING_MODES = Object.freeze(["global", "rule", "direct", "script"]);

function supportsScriptMode(coreType) {
    return normalizeCoreType(coreType) === CORE_TYPES.CLASH;
}

function builtinProxyTargets(coreType) {
    return normalizeCoreType(coreType) === CORE_TYPES.CLASH ? ["DIRECT", "REJECT", "GLOBAL"]
        : ["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE", "GLOBAL"];
}

function supportsAnyTls(coreType) { return normalizeCoreType(coreType) !== CORE_TYPES.CLASH; }

function isRoutingModeSupported(coreType, mode) {
    return ROUTING_MODES.includes(mode) && (mode !== "script" || supportsScriptMode(coreType));
}

function normalizeRoutingMode(coreType, mode) {
    return mode === "script" && !supportsScriptMode(coreType) ? "rule" : mode;
}

module.exports = {
    ROUTING_MODES,
    supportsScriptMode,
    builtinProxyTargets,
    supportsAnyTls,
    isRoutingModeSupported,
    normalizeRoutingMode
};
