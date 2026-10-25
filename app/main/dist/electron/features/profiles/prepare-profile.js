"use strict";

const { isTapDns } = require("../../core/network/legacy-tap-policy");

function normalizeLegacyDnsFilters(config) {
    const filters = config.dns?.["fake-ip-filter"];
    const legacyFilter = " *.n.n.srv.nintendo.net";
    if (!Array.isArray(filters) || !filters.includes(legacyFilter)) return config;
    // Older General templates included this space. Mihomo rejects it; repair
    // the applied payload without rewriting the user's saved Mixin or profile.
    return {
        ...config,
        dns: {
            ...config.dns,
            "fake-ip-filter": filters.map(value => value === legacyFilter ? value.slice(1) : value)
        }
    };
}

function secureProviderPaths(config, hash) {
    const providers = [];
    const redirects = [];
    for (const [key, kind] of [["proxy-providers", "proxy"], ["rule-providers", "rule"]]) {
        for (const provider of Object.values(config[key] || {})) {
            providers.push(provider);
            const effective = { ...provider["<<"], ...provider };
            if (effective.type === "http") {
                const securePath = `./providers/${kind}/${hash(effective.url)}.yaml`;
                redirects.push({ path: provider.path, securePath });
                provider.path = securePath;
            }
        }
    }
    for (const provider of providers) {
        if ({ ...provider["<<"], ...provider }.type === "file") {
            const redirect = redirects.find(item => item.path === provider.path);
            if (redirect) provider.path = redirect.securePath;
        }
    }
    return providers.length > 0;
}

async function prepareProfile({ source, profile, settings, tunConfig, mixinEnabled }, {
    yaml, compileMixin, mixinHelpers, hash, runMixin
}) {
    let config = yaml.parse(source, { prettyErrors: true, strict: false });
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw Object.assign(new Error("this profile could not be parsed!"), { code: "CFW_PROFILE_NOT_MAPPING" });
    }
    // This local Mixin authorization marker must never be inherited from a profile.
    if (Object.hasOwn(config, "cfw-tap")) {
        config = { ...config };
        delete config["cfw-tap"];
    }
    let tapAuthorized = false;
    if (tunConfig) config = { ...config, ...tunConfig };
    if (mixinEnabled) {
        if (Number(settings.mixinType || 0) === 0 && settings.mixinText) {
            // Preserve the legacy policy: an invalid optional YAML mixin is ignored.
            try {
                const mixin = yaml.parse(settings.mixinText).mixin;
                tapAuthorized = !!mixin?.dns && Object.hasOwn(mixin.dns, "enable")
                    && Object.hasOwn(mixin.dns, "listen") && isTapDns(mixin.dns);
                config = { ...config, ...mixin };
            } catch (_error) {}
        } else if (Number(settings.mixinType) === 1 && settings.mixinCode) {
            const payload = { content: config, url: profile.url || "", name: profile.name };
            config = runMixin ? await runMixin(payload) : await compileMixin(settings.mixinCode).parse(payload, mixinHelpers);
            // JavaScript may pass through subscription DNS unchanged. Require explicit consent.
            tapAuthorized = !!config && Object.hasOwn(config, "cfw-tap") && config["cfw-tap"] === true && isTapDns(config.dns);
        }
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw Object.assign(new Error("Mixin must return a configuration object"), { code: "CFW_MIXIN_NOT_MAPPING" });
    }
    if (Object.hasOwn(config, "cfw-tap")) {
        config = { ...config };
        delete config["cfw-tap"];
    }
    config = normalizeLegacyDnsFilters(config);
    const hasProviders = secureProviderPaths(config, hash);
    return { config, hasProviders, tapAuthorized };
}

module.exports = { prepareProfile, secureProviderPaths, normalizeLegacyDnsFilters };
