"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const draggable = require("../../main/node_modules/vuedraggable");
const yaml = require("../../main/node_modules/yaml");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { createProfileEditor } = require("../../main/dist/electron/features/profiles/profile-editor-page");
const { createRuleEditor } = require("../../main/dist/electron/features/profiles/rule-editor-page");
const { buildProxyConfig } = require("../../main/dist/electron/features/profiles/proxy-editor-config");

const Vuex = { mapState: () => ({}), mapGetters: () => ({}) };
const labels = createTranslator(1);
function fixture(config) {
    let source = yaml.stringify(config);
    const dependencies = {
        defineComponent, Vuex, yaml, path, getLanguage: () => labels, buildProxyConfig,
        draggable, lodash: { debounce: fn => fn },
        moment: () => ({ locale() { return this; }, fromNow: () => "now" }),
        notify() {}, cloneJson: value => JSON.parse(JSON.stringify(value)), schedule() {},
        profileFiles: {
            readProfile: async () => source,
            writeProfile: async (_directory, _name, content) => { source = content; }
        }
    };
    const Profile = createProfileEditor(dependencies);
    const Rules = createRuleEditor(dependencies);
    function instance(component, propsData = {}) {
        const vm = new (Vue.extend(component))({ propsData });
        vm.profilesPath = "virtual-profiles";
        return vm;
    }
    function append(original, type = 1, changes = {}) {
        const vm = instance(Profile.components.AppendProxyView, { type, data: original && { ...original, _index: 0 } });
        vm.$options.mounted.forEach(hook => hook.call(vm));
        Object.assign(vm, changes);
        let result;
        vm.$on("inputDone", value => { result = value; });
        vm.confirmInput();
        const error = vm.validationError;
        vm.$destroy();
        return { result, error };
    }
    function rules() {
        const vm = instance(Rules, { profileName: "profile.yaml" });
        vm.clashApi = {
            getRules: async () => ({ data: { rules: [] } }),
            getRuleProviders: async () => ({ data: { providers: {} } }),
            updateRuleProvider: async () => ({ status: 204 })
        };
        return vm;
    }
    return { Profile, instance, append, rules, saved: () => yaml.parse(source), savedText: () => source };
}

test("every graphical drag source clones names and saves string members across repeated renders", async () => {
    const node = { name: "001 & Tokyo", type: "http", server: "127.0.0.1", port: 443 };
    const group = { name: "Auto", type: "select", proxies: ["DIRECT"] };
    const target = { name: "Test", type: "select", proxies: [] };
    const f = fixture({ proxies: [node], "proxy-groups": [group, target], rules: ["MATCH,Test"] });
    const vm = f.instance(f.Profile);
    await vm.loadData();
    for (let pass = 0; pass < 2; pass++) {
        const widgets = [];
        function walk(vnode) {
            if (vnode.componentOptions?.tag === "draggable") widgets.push(vnode);
            for (const child of vnode.children || vnode.componentOptions?.children || []) walk(child);
        }
        // Use the shipped Vue's prop extraction and vuedraggable's real clone
        // default, so sharing a mutable attrs object reproduces the regression.
        walk(vm._render());
        const sources = widgets.filter(vnode => vnode.data.attrs.group.pull === "clone");
        assert.equal(sources.length, 3);
        const destination = widgets.find(vnode => vnode.data.model.value === vm.conf["proxy-groups"][1].proxies);
        for (const source of sources) {
            const drag = new source.componentOptions.Ctor({ propsData: source.componentOptions.propsData });
            const original = source.data.model.value[0];
            const cloned = drag.clone(original);
            assert.equal(cloned, original.name, source.data.model.expression);
            destination.data.model.callback([...vm.conf["proxy-groups"][1].proxies, cloned]);
            drag.$destroy();
        }
        await Vue.nextTick();
    }
    await vm.saveData();
    assert.deepEqual(f.saved()["proxy-groups"][1].proxies, ["DIRECT", "Auto", node.name, "DIRECT", "Auto", node.name]);
    assert.deepEqual(f.saved().proxies, [node]);
    assert.deepEqual(f.saved()["proxy-groups"][0], group);
    assert.doesNotMatch(f.savedText(), /[&*]a\d+/);
    vm.$destroy();
});

test("rule editing preserves nested logical rules, unknown extensions and exact rule text", async () => {
    const rules = ["AND,((NETWORK,UDP),(DST-PORT,443)),REJECT", "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve", "MATCH,DIRECT"];
    const f = fixture({ rules });
    const vm = f.rules();
    await vm.loadData();
    await vm.applyRules();
    assert.deepEqual(f.saved().rules, rules);
    vm.$destroy();
});

test("searching rules and refreshing a provider preserve unsaved edits and handle incomplete regexes", async () => {
    const f = fixture({ rules: ["RULE-SET,local,DIRECT", "MATCH,DIRECT"] });
    const vm = f.rules();
    await vm.loadData();
    vm.inputDone({ type: "DOMAIN", payload: "new.test", proxy: "DIRECT" });
    vm.handleFilterKeywordInput({ target: { value: "new" } });
    await Vue.nextTick();
    assert.equal(vm.memoryData.length, 3);
    assert.equal(vm.listData.length, 1);
    await vm.handleRuleClick({ type: "RULE-SET", payload: "local" });
    assert.equal(vm.memoryData.length, 3);
    vm.handleFilterKeywordInput({ target: { value: "[" } });
    assert.equal(vm.memoryData.length, 3);
    vm.$destroy();
});

test("rule files remain editable while the controller is offline", async () => {
    const f = fixture({ rules: ["MATCH,DIRECT"] });
    const vm = f.rules();
    vm.clashApi.getRules = vm.clashApi.getRuleProviders = async () => { throw Error("offline"); };
    await vm.loadData();
    assert.equal(vm.memoryData.length, 1);
    vm.$destroy();
});

test("deleting duplicate-looking rules removes the clicked row including its parameters", async () => {
    const f = fixture({ rules: ["IP-CIDR,10.0.0.0/8,DIRECT,no-resolve", "IP-CIDR,10.0.0.0/8,DIRECT"] });
    const vm = f.rules();
    await vm.loadData();
    vm.removeItem(vm.listData[1], 1);
    await vm.applyRules();
    assert.deepEqual(f.saved().rules, ["IP-CIDR,10.0.0.0/8,DIRECT,no-resolve"]);
    vm.$destroy();
});

test("group edits preserve provider references and all unexposed group options", async () => {
    const group = { name: "Auto", type: "select", use: ["local"], filter: "JP", lazy: false, tolerance: 100 };
    const f = fixture({ "proxy-groups": [group], rules: ["MATCH,Auto"] });
    const vm = f.instance(f.Profile);
    await vm.loadData();
    vm.handleInputDone(f.append(group, 0).result);
    assert.deepEqual(JSON.parse(JSON.stringify(vm.conf["proxy-groups"][0])), group);
    vm.$destroy();
});

test("node edits and removal tolerate provider-only groups and preserve rule flags", async () => {
    const node = { name: "node", type: "socks5", server: "127.0.0.1", port: 1234 };
    const f = fixture({ proxies: [node], "proxy-groups": [{ name: "Auto", type: "select", use: ["local"] }],
        rules: ["IP-CIDR,10.0.0.0/8,node,no-resolve", "AND,((NETWORK,UDP),(DST-PORT,443)),node", "MATCH,Auto"] });
    const vm = f.instance(f.Profile);
    await vm.loadData();
    vm.handleInputDone(f.append(node, 1, { proxyName: "renamed" }).result);
    assert.deepEqual(vm.conf.rules, ["IP-CIDR,10.0.0.0/8,renamed,no-resolve", "AND,((NETWORK,UDP),(DST-PORT,443)),renamed", "MATCH,Auto"]);
    vm.removeFromProxies({ stopPropagation() {} }, 0);
    assert.deepEqual(vm.conf["proxy-groups"][0].use, ["local"]);
    vm.$destroy();
});

test("SS plugin and VMess transport options survive unrelated graphical edits", () => {
    const f = fixture({});
    const ss = { name: "node", type: "ss", server: "127.0.0.1", port: 1234, cipher: "aes-128-gcm", password: "fixture",
        plugin: "v2ray-plugin", "plugin-opts": { mode: "websocket", tls: true, host: "example.test", path: "/ws" } };
    assert.deepEqual(f.append(ss, 1, { proxyName: "renamed" }).result.content, { ...ss, name: "renamed" });
    const ws = { name: "node", type: "vmess", server: "127.0.0.1", port: 1234, cipher: "auto", alterId: 0,
        uuid: "00000000-0000-4000-8000-000000000000", network: "ws",
        "ws-opts": { path: "/ws", headers: { Host: "example.test" }, "max-early-data": 1024 } };
    assert.deepEqual(f.append(ws).result.content, ws);
    const grpc = { ...ws, network: "grpc", "grpc-opts": { "grpc-service-name": "fixture" } };
    delete grpc["ws-opts"];
    assert.equal(f.append(grpc).result.content.network, "grpc");
});

test("clearing HTTP and SOCKS credentials removes only the edited fields", () => {
    const f = fixture({});
    for (const type of ["http", "socks5"]) {
        const original = { name: "node", type, server: "127.0.0.1", port: 1234, username: "fixture", password: "fixture" };
        const cleared = f.append(original, 1, { proxyUsername: "", proxyPassword: "" }).result.content;
        assert.equal("username" in cleared, false);
        assert.equal("password" in cleared, false);
        const partial = f.append(original, 1, { proxyPassword: "" }).result.content;
        assert.equal(partial.username, "fixture");
        assert.equal("password" in partial, false);
    }
});

test("graphical port validation rejects invalid values without closing or emitting a node", () => {
    const f = fixture({});
    for (const proxyPort of ["", "0", "65536", "1234.5", "not-a-port"]) {
        const { result, error } = f.append(null, 1, { proxyName: "new-node", proxyPort });
        assert.equal(result, undefined, proxyPort);
        assert.equal(error, labels.invalidPort());
    }
});

test("AnyTLS edits preserve omitted core defaults until a field is explicitly changed", () => {
    const f = fixture({});
    const original = { name: "node", type: "anytls", server: "127.0.0.1", port: 443, password: "fixture" };
    assert.deepEqual(f.append(original, 1, { proxyName: "renamed" }).result.content, { ...original, name: "renamed" });
    const updated = f.append(original, 1, { proxyClientFingerprint: "firefox" }).result.content;
    assert.equal(updated["client-fingerprint"], "firefox");
    assert.equal("alpn" in updated, false);
    assert.equal(f.append(null, 1, { proxyName: "new-node", proxyType: "anytls", proxyPort: "443" }).result.content["client-fingerprint"], "chrome");
});

test("opening then cancelling a graphical edit never leaks editor indices into the profile", async () => {
    const node = { name: "node", type: "http", server: "127.0.0.1", port: 443 };
    const group = { name: "Auto", type: "select", proxies: ["node"] };
    const f = fixture({ proxies: [node], "proxy-groups": [group], rules: ["MATCH,Auto"] });
    const vm = f.instance(f.Profile);
    await vm.loadData();
    vm.editProxy(vm.conf.proxies[0], 0);
    vm.editGroup(vm.conf["proxy-groups"][0], 0);
    await vm.saveData();
    assert.deepEqual(f.saved(), { proxies: [node], "proxy-groups": [group], rules: ["MATCH,Auto"] });
    vm.$destroy();
});

test("renaming preserves rule namespaces, nested rule flags and dialer proxy references", async () => {
    const f = fixture({ proxies: [{ name: "node", "dialer-proxy": "Auto" }], "proxy-groups": [],
        rules: ["SUB-RULE,(NETWORK,UDP),Auto", "DOMAIN-REGEX,^[(]$,Auto"], "sub-rules": { Auto: ["IP-CIDR,10.0.0.0/8,Auto,no-resolve"] } });
    const vm = f.instance(f.Profile);
    await vm.loadData(); vm.renameGroup("Auto", "Renamed"); vm.renameRule("Auto", "Renamed");
    assert.equal(vm.conf.proxies[0]["dialer-proxy"], "Renamed");
    assert.equal(vm.conf.rules[0], "SUB-RULE,(NETWORK,UDP),Auto");
    assert.equal(vm.conf.rules[1], "DOMAIN-REGEX,^[(]$,Renamed");
    assert.equal(vm.conf["sub-rules"].Auto[0], "IP-CIDR,10.0.0.0/8,Renamed,no-resolve");
    vm.$destroy();
});

test("valid profiles with omitted optional lists accept new nodes and groups", async () => {
    const f = fixture({ rules: ["MATCH,DIRECT"] });
    const vm = f.instance(f.Profile);
    await vm.loadData();
    vm.handleInputDone({ type: 1, index: -1, content: { name: "node", type: "http", server: "127.0.0.1", port: 443 } });
    vm.handleInputDone({ type: 0, index: -1, content: { name: "Auto", type: "select", proxies: ["node"] } });
    assert.equal(vm.conf.proxies.length, 1);
    assert.equal(vm.conf["proxy-groups"].length, 1);
    vm.$destroy();
});

test("malformed or unreadable rule files cannot be overwritten with an empty list", async () => {
    const f = fixture({ rules: "invalid-shape" });
    const vm = f.rules();
    await vm.loadData();
    assert.equal(await vm.applyRules(), false);
    assert.equal(f.saved().rules, "invalid-shape");
    vm.$destroy();
});

test("invalid WebSocket headers keep the modal open instead of deleting saved headers", () => {
    const f = fixture({});
    const original = { name: "node", type: "vmess", server: "127.0.0.1", port: 443, network: "ws" };
    for (const proxyWsHeaders of ["{", "[]", "null"]) {
        const { result, error } = f.append(original, 1, { proxyWsHeaders });
        assert.equal(result, undefined);
        assert.equal(error, labels.invalidWebSocketHeaders());
    }
});
