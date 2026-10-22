"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const yaml = require("../../main/node_modules/yaml");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { createProfileEditor } = require("../../main/dist/electron/features/profiles/profile-editor-page");
const { references, replaceReferences, removeReferences, invalidReferences, circularReferences } = require("../../main/dist/electron/features/profiles/profile-references");
const { builtinProxyTargets } = require("../../main/dist/electron/core/clash-core/core-capabilities");

function config() {
    return { proxies: [{ name: "A", type: "http", server: "localhost", port: 80 }, { name: "B", "dialer-proxy": "A" }],
        "proxy-groups": [{ name: "Group", type: "select", proxies: ["A", "DIRECT"] }],
        rules: ["AND,((NETWORK,UDP),(DST-PORT,443)),A", "IP-CIDR,10.0.0.0/8,A,no-resolve", "SUB-RULE,(NETWORK,TCP),A"],
        "sub-rules": { A: ["MATCH,A"] }, "rule-providers": { local: { proxy: "A" } } };
}

function editor(document, choices = []) {
    let saved = yaml.stringify(document), writes = 0;
    const prompts = [], alerts = [];
    const Component = createProfileEditor({ defineComponent, Vuex: { mapState: () => ({}) }, yaml,
        getLanguage: () => createTranslator(1), profileFiles: {
            readProfile: async () => saved,
            writeProfile: async (_directory, _name, source) => { saved = source; writes++; }
        } });
    const vm = new (Vue.extend(Component))({ propsData: { profileName: "test.yaml" } });
    vm.$select = async options => { prompts.push(options); const value = choices.shift(); if (value === undefined) throw Error("cancelled"); return Array.isArray(value) ? value : [value]; };
    vm.$alert = async options => { alerts.push(options); };
    return { vm, prompts, alerts, get writes() { return writes; }, saved: () => yaml.parse(saved) };
}

test("replacement preserves logical rules, flags and SUB-RULE namespaces and updates every supported reference", () => {
    const document = config();
    assert.equal(references(document).filter(item => item.target === "A").length, 6);
    replaceReferences(document, "A", "DIRECT");
    assert.deepEqual(document.rules, ["AND,((NETWORK,UDP),(DST-PORT,443)),DIRECT", "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve", "SUB-RULE,(NETWORK,TCP),A"]);
    assert.deepEqual(document["proxy-groups"][0].proxies, ["DIRECT"]);
    assert.equal(document.proxies[1]["dialer-proxy"], "DIRECT");
    assert.deepEqual(document["sub-rules"].A, ["MATCH,DIRECT"]);
    assert.equal(document["rule-providers"].local.proxy, "DIRECT");
});

test("deletion defaults to cancellation and displays the concrete affected paths", async () => {
    const f = editor(config(), [0]); await f.vm.loadData();
    assert.equal(await f.vm.removeFromProxies({ stopPropagation() {} }, 0), false);
    assert.equal(f.vm.conf.proxies.length, 2);
    assert.match(f.prompts[0].message, /rules\[1\]/);
    assert.match(f.prompts[0].message, /dialer-proxy/);
    f.vm.$destroy();
});

test("delete and recreate preserves group membership; saving unresolved deletions never overwrites the original file", async () => {
    const document = config();
    const f = editor(document, [3]); await f.vm.loadData();
    assert.equal(await f.vm.removeFromProxies({ stopPropagation() {} }, 0), true);
    assert.deepEqual(f.vm.conf["proxy-groups"][0].proxies, ["A", "DIRECT"]);
    assert.equal(await f.vm.saveData(), false);
    assert.equal(f.writes, 0); assert.equal(f.alerts.length, 1);
    f.vm.conf.proxies.push(document.proxies[0]);
    await f.vm.saveData(); assert.equal(f.writes, 1);
    assert.deepEqual(f.saved()["proxy-groups"][0].proxies, ["A", "DIRECT"]);
    f.vm.$destroy();
});

test("replace then delete leaves a saveable document and cancelling target selection leaves every field intact", async () => {
    const f = editor(config(), [1, [0, 0]]); await f.vm.loadData();
    const before = JSON.stringify(f.vm.conf);
    assert.equal(await f.vm.removeFromProxies({ stopPropagation() {} }, 0), false);
    assert.equal(JSON.stringify(f.vm.conf), before);
    f.vm.$destroy();
    const g = editor(config(), [1, [1, 0]]); await g.vm.loadData();
    assert.equal(await g.vm.removeFromProxies({ stopPropagation() {} }, 0), true);
    await g.vm.saveData(); assert.equal(g.writes, 1);
    assert.equal(g.saved().proxies[0]["dialer-proxy"], "DIRECT");
    g.vm.$destroy();
});

test("provider node names and built-in targets are valid; deleted local targets still need repair", () => {
    const document = { "proxy-providers": { local: {} }, "proxy-groups": [{ name: "G", use: ["local"] }],
        rules: ["MATCH,provider-node", "DOMAIN,example.test,REJECT-DROP", "DOMAIN,example.org,PASS"] };
    assert.deepEqual(invalidReferences(document), []);
    assert.deepEqual(invalidReferences(document, ["provider-node"]).map(item => item.target), ["provider-node"]);
});

test("replacement targets follow the selected core instead of offering Mihomo-only policies on Clash", () => {
    assert.deepEqual(builtinProxyTargets("clash"), ["DIRECT", "REJECT", "GLOBAL"]);
    assert.ok(builtinProxyTargets("mihomo").includes("PASS"));
    assert.equal(invalidReferences({ rules: ["MATCH,PASS"] }, [], "clash").length, 1);
    assert.equal(invalidReferences({ rules: ["MATCH,PASS"] }, [], "mihomo").length, 0);
});

test("AnyTLS creation is available only for Mihomo and existing AnyTLS data is not silently rewritten on Clash", () => {
    const Component = createProfileEditor({ defineComponent, Vuex: { mapState: () => ({}) }, getLanguage: () => createTranslator(1) }).components.AppendProxyView;
    const vm = new (Vue.extend(Component))({ propsData: { type: 1, coreType: "clash" } });
    assert.equal(vm.proxyTypes.includes("anytls"), false);
    vm.proxyName = "A"; vm.proxyPort = 443; vm.proxyType = "anytls";
    let emitted = false; vm.$on("inputDone", () => { emitted = true; }); vm.confirmInput();
    assert.equal(emitted, false); assert.match(vm.validationError, /Mihomo/); assert.equal(vm.proxyType, "anytls");
    vm.coreType = "mihomo"; assert.equal(vm.proxyTypes.includes("anytls"), true); vm.$destroy();
});

test("circular groups and dialer chains cannot be saved or introduced by replacement", async () => {
    assert.deepEqual(circularReferences({ proxies: [{ name: "A", "dialer-proxy": "B" }, { name: "B", "dialer-proxy": "A" }] }), ["A → B → A"]);
    const document = { proxies: [{ name: "A" }], "proxy-groups": [{ name: "G", proxies: ["A"] }], rules: ["MATCH,A"] };
    // The bounded choice list has built-ins, then G after excluding A.
    const f = editor(document, [1, [1, 6]]); await f.vm.loadData();
    assert.equal(await f.vm.removeObject("proxies", 0), false);
    assert.equal(f.vm.conf.proxies.length, 1); assert.equal(f.alerts.length, 1);
    f.vm.conf["proxy-groups"][0].proxies = ["G"];
    assert.equal(await f.vm.saveData(), false); assert.equal(f.writes, 0);
    f.vm.$destroy();
});

test("duplicate or reserved names keep the graphical form open", async () => {
    const f = editor(config()); await f.vm.loadData();
    f.vm.addType = 1;
    assert.equal(f.vm.handleInputDone({ type: 1, index: -1, content: { name: "A" } }), false);
    assert.equal(f.vm.addType, 1); assert.equal(f.vm.conf.proxies.length, 2);
    assert.equal(f.vm.handleInputDone({ type: 1, index: -1, content: { name: "DIRECT" } }), false);
    f.vm.$destroy();
});

test("hundreds of replacement targets are list choices with two actions, and an explicit confirmation selects the last target", async () => {
    const document = config();
    for (let index = 0; index < 500; index++) document.proxies.push({ name: `node-${index}` });
    const f = editor(document, [1, [1, 507]]); await f.vm.loadData();
    // Choose by the actual list index, including core-specific built-ins.
    f.vm.$select = async options => {
        f.prompts.push(options);
        return options.choiceItems ? [1, options.choiceItems.indexOf("node-499")] : [1];
    };
    assert.equal(await f.vm.removeObject("proxies", 0), true);
    const prompt = f.prompts[1];
    assert.equal(prompt.items.length, 2);
    assert.ok(prompt.choiceItems.length > 500);
    assert.equal(prompt.choiceItems.includes("A"), false);
    assert.equal(f.vm.conf.rules[0], "AND,((NETWORK,UDP),(DST-PORT,443)),node-499");
    f.vm.$destroy();
});

test("plain deletion removes associated rules, duplicate members and optional references while preserving unrelated rules and rule namespaces", async () => {
    const document = config();
    document.rules.push("DOMAIN,deleted.example,A", "DOMAIN,retained.example,DIRECT");
    document["proxy-groups"][0].proxies = ["A", "A", "DIRECT"];
    document["proxy-providers"] = { local: { proxy: "A", override: { "dialer-proxy": "A" } } };
    document.listeners = [{ name: "entry", proxy: "A" }];
    document.tunnels = [{ proxy: "A" }];
    const f = editor(document, [2]); await f.vm.loadData();
    assert.equal(await f.vm.removeObject("proxies", 0), true);
    assert.deepEqual(f.vm.conf.rules, ["SUB-RULE,(NETWORK,TCP),A", "DOMAIN,retained.example,DIRECT"]);
    assert.deepEqual(f.vm.conf["sub-rules"].A, []);
    assert.deepEqual(f.vm.conf["proxy-groups"][0].proxies, ["DIRECT"]);
    assert.equal(Object.hasOwn(f.vm.conf.proxies[0], "dialer-proxy"), false);
    assert.deepEqual(references(f.vm.conf).filter(item => item.target === "A"), []);
    await f.vm.saveData();
    assert.equal(f.writes, 1);
    f.vm.$destroy();
});

test("deleting the only group member also cleans dependent empty groups and their rules, preserving provider-backed groups", () => {
    const document = { "proxy-groups": [
        { name: "G1", proxies: ["A"] }, { name: "G2", proxies: ["G1"] },
        { name: "Provider", proxies: ["A"], use: ["local"] }, { name: "Keep", proxies: ["A", "DIRECT"] }
    ], rules: ["DOMAIN,one.example,G1", "MATCH,G2", "DOMAIN,two.example,Keep"] };
    assert.deepEqual(removeReferences(document, "A"), ["G1", "G2"]);
    assert.deepEqual(document["proxy-groups"].map(group => group.name), ["Provider", "Keep"]);
    assert.deepEqual(document.rules, ["DOMAIN,two.example,Keep"]);
});

test("plain deletion preserves unrelated entries when YAML aliases share member and rule arrays", () => {
    const members = ["A", "DIRECT"], rules = ["DOMAIN,removed.example,A", "MATCH,DIRECT"];
    const document = { "proxy-groups": [{ name: "One", proxies: members }, { name: "Two", proxies: members }],
        rules, "sub-rules": { Branch: rules } };
    assert.deepEqual(removeReferences(document, "A"), []);
    assert.deepEqual(members, ["DIRECT"]);
    assert.deepEqual(rules, ["MATCH,DIRECT"]);
    assert.equal(document["proxy-groups"].length, 2);
});
