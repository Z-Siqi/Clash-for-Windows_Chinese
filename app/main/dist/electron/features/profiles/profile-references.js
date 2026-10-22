"use strict";

const { parseRule, renameRuleTarget } = require("./rule-syntax");
const { builtinProxyTargets } = require("../../core/clash-core/core-capabilities");

function proxyNames(config, coreType) {
    return [...new Set([...builtinProxyTargets(coreType), ...(config.proxies || []).map(item => item.name),
        ...(config["proxy-groups"] || []).map(item => item.name)])].filter(name => typeof name === "string" && name);
}

// Paths describe the saved document, so a warning can point to the exact edit.
function references(config) {
    const found = [];
    const field = (object, key, path) => {
        if (typeof object?.[key] === "string" && object[key]) found.push({ target: object[key], path,
            set: value => { object[key] = value; }, remove: () => { delete object[key]; } });
    };
    const rules = (items, prefix) => (items || []).forEach((rule, index) => {
        if (typeof rule !== "string" || /^\s*SUB-RULE\s*,/.test(rule)) return;
        const target = parseRule(rule).proxy;
        if (target) found.push({ target, path: `${prefix}[${index + 1}]`, set: value => { items[index] = renameRuleTarget(rule, target, value); },
            remove: () => { if (items[index] === rule) items.splice(index, 1); } });
    });
    rules(config.rules, "rules");
    for (const [name, items] of Object.entries(config["sub-rules"] || {})) rules(items, `sub-rules.${name}`);
    for (const [index, group] of (config["proxy-groups"] || []).entries()) {
        (group.proxies || []).forEach((target, member) => {
            if (typeof target === "string" && target) found.push({ target, path: `proxy-groups[${index + 1}].proxies[${member + 1}]`,
                set: value => { group.proxies[member] = value; },
                // YAML aliases can expose the same array more than once.
                remove: () => { if (group.proxies[member] === target) group.proxies.splice(member, 1); } });
        });
    }
    for (const [index, proxy] of (config.proxies || []).entries()) field(proxy, "dialer-proxy", `proxies[${index + 1}].dialer-proxy`);
    for (const kind of ["proxy-providers", "rule-providers"]) {
        for (const [name, provider] of Object.entries(config[kind] || {})) {
            field(provider, "proxy", `${kind}.${name}.proxy`);
            if (kind === "proxy-providers") field(provider.override, "dialer-proxy", `${kind}.${name}.override.dialer-proxy`);
        }
    }
    for (const kind of ["listeners", "tunnels"]) {
        for (const [index, item] of (config[kind] || []).entries()) field(item, "proxy", `${kind}[${index + 1}].proxy`);
    }
    return found;
}

function replaceReferences(config, from, to) {
    if (from === to) return;
    const affectedGroups = (config["proxy-groups"] || []).filter(group => Array.isArray(group.proxies) && group.proxies.includes(from));
    for (const reference of references(config)) if (reference.target === from) reference.set(to);
    // Replacing a member with an existing member should not duplicate it.
    for (const group of affectedGroups) group.proxies = [...new Set(group.proxies)];
}

function removeReferences(config, target) {
    const pending = [target], removedGroups = [];
    for (const name of pending) {
        const affected = (config["proxy-groups"] || []).filter(group => group.proxies?.includes(name));
        // Remove array entries from the end so adjacent matching rules/members
        // keep their original indices until their own removal is processed.
        for (const reference of references(config).filter(item => item.target === name).reverse()) reference.remove();
        for (const group of affected) {
            if (group.proxies.length || group.use?.length) continue;
            config["proxy-groups"].splice(config["proxy-groups"].indexOf(group), 1);
            removedGroups.push(group.name); pending.push(group.name);
        }
    }
    return removedGroups;
}

function invalidReferences(config, removedNames = [], coreType) {
    const known = new Set(proxyNames(config, coreType));
    const removed = new Set(removedNames);
    // Provider node names are resolved by the core at load time. Do not reject
    // their names simply because they are absent from this local document.
    const dynamic = Object.keys(config["proxy-providers"] || {}).length > 0;
    return references(config).filter(item => !known.has(item.target) && (!dynamic || removed.has(item.target)));
}

function circularReferences(config) {
    const graph = new Map();
    for (const group of config["proxy-groups"] || []) graph.set(group.name, group.proxies || []);
    for (const proxy of config.proxies || []) graph.set(proxy.name, proxy["dialer-proxy"] ? [proxy["dialer-proxy"]] : []);
    const complete = new Set(), active = new Set(), cycles = [];
    function visit(name, chain) {
        if (active.has(name)) { cycles.push([...chain.slice(chain.indexOf(name)), name].join(" → ")); return; }
        if (complete.has(name) || !graph.has(name)) return;
        active.add(name);
        for (const target of graph.get(name)) visit(target, [...chain, name]);
        active.delete(name); complete.add(name);
    }
    for (const name of graph.keys()) visit(name, []);
    return cycles;
}

module.exports = { proxyNames, references, replaceReferences, removeReferences, invalidReferences, circularReferences };
