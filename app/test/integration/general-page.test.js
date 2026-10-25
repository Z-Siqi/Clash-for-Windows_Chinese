"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createGeneralPage } = require("../../main/dist/electron/features/clash-core/general-page");
const { assertRendererComposition } = require("../fixtures/assert-renderer-composition");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { buildTunConfig } = require("../../main/dist/electron/features/tun/build-tun-config");

Vue.use(Vuex);

const labels = new Proxy({}, { get: (_target, key) => () => String(key) });
const EmptyComponent = { render: h => h("span") };

function createPage(overrides = {}) {
    const workflow = {
        data: () => ({
            iconPath: "logo.png", port: 7890, logLevel: "info", isAllowLan: false,
            bindAddress: "", isIPV6: false, clashCoreVersion: "1.0.0", geoipUpdateTime: "today",
            serviceNeedUpdate: false, autoLaunch: false, isTunSettingsVisible: false,
            isInterfacesVisible: false, isResetDNSSettingsVisible: false,
            isFetchingFirewallRule: false
        }),
        watch: {},
        computed: { autoLaunchHint: () => "auto launch", isShowNewIcon: () => false },
        methods: {}, mounted() {}, beforeRouteEnter() {}, beforeRouteLeave() {}
    };
    return createGeneralPage({
        defineComponent, Vuex, getLanguage: () => labels, version: "0.20.39 Opt-3", workflow,
        components: {
            SelectView: EmptyComponent, SwitchView: EmptyComponent, SimpleInput: EmptyComponent,
            EscCapture: EmptyComponent, InfoIcon: EmptyComponent, Hint: EmptyComponent
        },
        shell: { openPath() {}, openExternal() {} },
        fs: { readFileSync: () => Buffer.from("") },
        yaml: { stringify: value => JSON.stringify(value) },
        platform: { isWindows: () => false, isMacOS: () => false },
        utilities: { buildTunConfig: value => JSON.parse(JSON.stringify(value)), showMessageBox: async () => ({ response: 0 }) },
        scheduler: { add: () => 1, stop() {} },
        getNetworkAddresses: async () => ({}),
        ...overrides
    });
}

function text(vnode) {
    if (!vnode) return "";
    const children = vnode.children || vnode.componentOptions?.children || [];
    return (vnode.text || "") + children.map(text).join("");
}

test("opening and saving TUN settings preserves runtime DNS interception defaults and explicit choices", async () => {
    const component = createPage({ platform: { isWindows: () => true, isMacOS: () => false } }).components.TunSettingsView;
    for (const core of ["clash", "mihomo"]) {
        for (const saved of [{}, { dnsHijacks: [] }, { dnsHijacks: ["any:53"] }, { dnsHijacks: ["tcp://any:53"] }]) {
            let persisted;
            const vm = new (Vue.extend(component))({ store: new Vuex.Store({ state: { app: { tunSettings: saved, settings: { proxyCore: core } } },
                mutations: { SET_TUN_SETTINGS: (_state, value) => { persisted = value.settings; } } }) });
            vm.setupComponent(saved);
            assert.deepEqual(Array.from(vm.dnsHijacks), saved.dnsHijacks || []);
            assert.equal(await vm.handleSave(), true);
            assert.deepEqual(buildTunConfig(persisted, "win32", core), buildTunConfig(saved, "win32", core));
            vm.$destroy();
        }
    }
});

test("TUN policy input clicks cannot add an empty value; only the add button commits", () => {
    const component = createPage().components.TunSettingsView.components.EditObject;
    const vm = new (Vue.extend(component))({ propsData: { object: {} } });
    const nodes = node => !node ? [] : [node, ...(node.children || node.componentOptions?.children || []).flatMap(nodes)];
    const rendered = nodes(vm._render());
    const input = rendered.find(node => node.data?.directives?.some(item => item.expression === "addKey"));
    const button = rendered.find(node => node.tag === "button" && node.data?.on?.click);
    input.data.on.input({ target: { value: "example.test" } });
    assert.equal(vm.addKey, "example.test");
    assert.equal(rendered.filter(node => node.data?.on?.click === vm.handleAddItem).length, 1);
    assert.equal(button.data.attrs.type, "button");
    const changes = [];
    vm.$on("changed", value => changes.push(value));
    button.data.on.click();
    assert.deepEqual(changes, [{ "example.test": "" }]);
    vm.$destroy();
});

test("macOS TUN DNS tooltip and reset dialog follow both languages and preserve DNS edits", async () => {
    const selection = Vue.observable({ language: 0 });
    const labels = createTranslator(() => selection.language);
    const page = createPage({ getLanguage: () => labels });
    const store = new Vuex.Store({ state: { app: { userDNS: ["1.1.1.1"], confData: {}, currentProfilePayload: {} } },
        getters: { controllerPort: () => 9090 } });
    const settings = { isUsingResetDNSServers: true, resetDNSServers: ["8.8.8.8"] };
    const dns = new (Vue.extend({ mixins: [page.components.ResetDNSSettingsView], computed: { settings: () => settings } }))({ store });
    dns.setupComponent();
    const general = new (Vue.extend({ mixins: [page], computed: {
        settings: () => settings, isWindows: () => false, isMacOS: () => true, isLinux: () => false
    } }))({ store });
    const hints = node => !node ? [] : [node.data?.attrs?.hint, ...(node.children || node.componentOptions?.children || []).flatMap(hints)].filter(Boolean);
    for (const language of [0, 1, 0]) {
        selection.language = language;
        await Vue.nextTick();
        const rendered = text(dns._render());
        for (const key of ["resetDNSSettings", "resetDNSSettingsDescribe", "customServers", "detectedServers", "enable", "save"]) {
            assert.ok(rendered.includes(labels[key]()), `${language}/${key}`);
        }
        assert.ok(hints(general._render()).includes(labels.resetDNSSettingsHint()));
        assert.deepEqual(Array.from(dns.servers), ["8.8.8.8"]);
    }
    dns.servers = ["9.9.9.9"];
    dns.handleSave();
    assert.deepEqual(Array.from(settings.resetDNSServers), ["9.9.9.9"]);
    assert.equal(settings.isUsingResetDNSServers, true);
    assert.deepEqual(Array.from(store.state.app.userDNS), ["1.1.1.1"]);
    dns.$destroy(); general.$destroy();
});

test("General page: extracted production component constructs and renders with real Vue", () => {
    const appState = {
        isDevMode: false, clashPath: "profile", clashStatus: "connected", confData: {},
        isMixinEnable: false, isTunEnable: false, status: "connected", isWindowShow: true,
        isLocalMode: true, isLaunching: false, isSystemProxyOn: false, isSilentUpgraded: false,
        updateDownloadProgress: 0, isFirewallRuleExist: false, currentProfilePayload: {},
        matchedSSID: "", tunSettings: {}, userDNS: []
    };
    const getters = Object.fromEntries([
        "resourcesPath", "filesPath", "mixedPort", "clashAxiosClient", "controllerPort", "secret"
    ].map(name => [name, () => name === "controllerPort" ? 9090 : ""]));
    const store = new Vuex.Store({ state: { app: appState }, getters });
    const capabilities = {
        computed: {
            settings: () => ({ randomMixedPort: false }),
            isWindows: () => false,
            isMacOS: () => false,
            isLinux: () => true
        }
    };
    const Component = Vue.extend({ mixins: [capabilities, createPage()] });
    const vm = new Component({ store });

    const rendered = vm._render();
    assert.equal(rendered.data.staticClass, "main-general-view");
    assert.match(text(rendered), /0\.20\.39 Opt-3/);
    assert.match(text(rendered), /port/);
    assert.equal(vm.$options._scopeId, "data-v-357ec510");
    vm.$destroy();
});

test("General page: extracted editors preserve model events and error repair uses localized confirmation", async () => {
    const page = createPage();
    const EditList = page.components.TunSettingsView.components.EditList;
    const list = new (Vue.extend(EditList))({ propsData: { list: ["one"] } });
    let changed;
    list.$on("changed", value => { changed = value; });
    list.handleAddItem();
    assert.deepEqual(changed, ["one", ""]);
    list.handleChangeItem({ target: { value: "two" } }, 0);
    assert.deepEqual(changed, ["two"]);

    const calls = [];
    const customLabels = new Proxy({}, { get: (_target, key) => () => String(key) });
    const repairedPage = createPage({
        getLanguage: () => customLabels,
        utilities: {
            buildTunConfig: value => value,
            showMessageBox: async options => { calls.push(options); return { response: 1 }; }
        }
    });
    await repairedPage.components.ErrorView.methods.autoFix.call({
        $parent: { autoFix: () => calls.push("repair") }
    });
    assert.deepEqual(calls[0].buttons, ["no", "yes"]);
    assert.equal(calls[1], "repair");
    list.$destroy();
});

test("General page: production entry delegates without duplicate page owners", () => {
    assertRendererComposition("createGeneralPage", [
        'name: "TunSettingsView"', 'name: "EditListView"', 'name: "EditObjectView"',
        'name: "ResetDNSSettingsView"', 'name: "InterfacesView"', "lg.yes()"
    ]);
});

test("General page: named factory composes the page component", () => {
    const component = createPage({
        utilities: {
            buildTunConfig: value => ({ generated: value.ipv6 }),
            showMessageBox: async () => ({ response: 0 })
        }
    });
    assert.equal(typeof component.render, "function");
    assert.equal(component._scopeId, "data-v-357ec510");
    assert.equal(component.components.TunSettingsView._scopeId, "data-v-b6dface2");
    assert.deepEqual(component.components.TunSettingsView.computed.obj.call({ $data: { ipv6: true } }), { generated: true });
});
