"use strict";

const DEFAULT_YAML_MIXIN = "mixin: {}\n";
const DEFAULT_CODE_MIXIN = "module.exports.parse = ({ content }) => content\n";

function ensureMixinDefaults(settings) {
    const type = Number(settings.mixinType || 0);
    if (type === 0 && !String(settings.mixinText || "").trim()) {
        settings.mixinText = DEFAULT_YAML_MIXIN;
    }
    if (type === 1 && !String(settings.mixinCode || "").trim()) {
        settings.mixinCode = DEFAULT_CODE_MIXIN;
    }
    return settings;
}

function validateMixinSettings(settings, { parseYaml, compileCode }) {
    const type = Number(settings.mixinType || 0);
    if (type === 0) {
        const parsed = parseYaml(settings.mixinText);
        if (!parsed || !parsed.mixin || typeof parsed.mixin !== "object" || Array.isArray(parsed.mixin)) {
            throw new Error("YAML mixin must contain a 'mixin' object");
        }
        return true;
    }
    if (type === 1) {
        if (compileCode) {
            const compiled = compileCode(settings.mixinCode);
            if (!compiled || typeof compiled.parse !== "function") {
                throw new Error("JavaScript mixin must export a parse function");
            }
            return true;
        }
        Function("module", "exports", settings.mixinCode);
        if (!/module\.exports\.parse\s*=/.test(settings.mixinCode)) {
            throw new Error("JavaScript mixin must export a parse function");
        }
        return true;
    }
    throw new Error(`Unsupported mixin type: ${type}`);
}

module.exports = {
    DEFAULT_YAML_MIXIN,
    DEFAULT_CODE_MIXIN,
    ensureMixinDefaults,
    validateMixinSettings
};
