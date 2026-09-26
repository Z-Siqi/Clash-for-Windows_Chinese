"use strict";

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
    yaml, compileMixin, mixinHelpers, hash
}) {
    let config = yaml.parse(source, { prettyErrors: true, strict: false });
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw new Error("this profile could not be parsed!");
    }
    if (tunConfig) config = { ...config, ...tunConfig };
    if (mixinEnabled) {
        if (Number(settings.mixinType || 0) === 0 && settings.mixinText) {
            // Preserve the legacy policy: an invalid optional YAML mixin is ignored.
            try { config = { ...config, ...yaml.parse(settings.mixinText).mixin }; } catch (_error) {}
        } else if (Number(settings.mixinType) === 1 && settings.mixinCode) {
            config = await compileMixin(settings.mixinCode).parse({
                content: config, url: profile.url || "", name: profile.name
            }, mixinHelpers);
        }
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw new Error("Mixin must return a configuration object");
    }
    const hasProviders = secureProviderPaths(config, hash);
    return { config, hasProviders };
}

module.exports = { prepareProfile, secureProviderPaths };
