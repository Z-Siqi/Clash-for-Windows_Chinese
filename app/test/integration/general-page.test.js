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
        os: { networkInterfaces: () => ({}) },
        ...overrides
    });
}

function text(vnode) {
    if (!vnode) return "";
    const children = vnode.children || vnode.componentOptions?.children || [];
    return (vnode.text || "") + children.map(text).join("");
}

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
