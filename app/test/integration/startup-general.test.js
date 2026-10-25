"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const yaml = require("../../main/node_modules/yaml");
const { homePage } = require("../fixtures/home-page");
const { buildStore } = require("../fixtures/renderer-store");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createGeneralPage } = require("../../main/dist/electron/features/clash-core/general-page");
const { createGeneralPageWorkflow } = require("../../main/dist/electron/features/clash-core/general-page-workflow");
const { refreshProfile } = require("../../main/dist/electron/entry/renderer/refresh-profile");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

const nodes = node => node ? [node, ...(node.children || node.componentOptions?.children || []).flatMap(nodes)] : [];
const labels = createTranslator(1);
const Empty = { render: h => h("span") };

function fixture(t, { tun, mixin }) {
    const persisted = new Map(), first = buildStore({ home: "virtual", storage: persisted });
    first.store.commit("CHANGE_IS_TUN_ENABLE", { isTun: tun });
    first.store.commit("CHANGE_IS_MIXIN_ENABLE", { isMixin: mixin });
    const { store, connectionStatus, proxyStatus } = buildStore({ home: "virtual", storage: persisted });
    store.commit("SET_CONF_DATA", { data: { "mixed-port": 7890, "allow-lan": true, "log-level": "warning", ipv6: true } });
    store.commit("SET_SETTINGS_OBJECT", { obj: { proxyCore: "mihomo", legacyTapMode: "mixin", mixinType: 0,
        mixinText: "mixin:\n  interface-name: test\n  dns: {enable: true, listen: ':53'}\n" } });
    store.state.app.profiles = { index: 0, files: [{ time: "local.yml" }] };
    let accept, release, writes = 0, holdTap = false, tapStarted, resumeTap;
    const entered = new Promise(resolve => { accept = resolve; }), gate = new Promise(resolve => { release = resolve; });
    const tapEntered = new Promise(resolve => { tapStarted = resolve; }), tapGate = new Promise(resolve => { resumeTap = resolve; });
    const api = { isReady: () => true, getConfig: async () => ({ status: 200, data: store.state.app.confData }),
        getVersion: async () => ({ status: 200, data: { version: "fixture" } }),
        async putConfig() { writes++; accept(); await gate; return { status: 204 }; } };
    let ready = true, probes = 0;
    const page = homePage({ connectionStatus, proxyStatus, getLanguage: () => labels,
        runtimeProcess: { platform: "win32", arch: "x64" }, isWindows: () => true, isLinux: () => false, refreshRendererProfile: refreshProfile,
        profileFiles: { readProfile: async () => "rules: []\n" }, profileNetworkEffects: { hasTap: async () => true },
        startPacServer: async () => ({ port: 1234 }),
        createTunRuntime: () => ({ killSpawned: async () => {}, async spawnTun2socks() {
            tapStarted(); if (holdTap) await tapGate; return { pid: 42 };
        } }),
        createClashCoreRuntime: () => ({ start: async () => ({}), stop: async () => {},
            async getStatus() { probes++; return { connected: ready, mixedPort: ready ? 7890 : -1 }; } }),
        electron: { shell: {}, ipcRenderer: { send() {}, on() {}, async invoke(channel, operation, name) {
            if (channel === "app" && operation === "getPath") return name === "home" ? "virtual" : path.join("virtual", "cfw");
            if (channel === "app" && operation === "getRuntimeInfo") return { portableDataExists: false, release: "10" };
            return channel === "app" && operation === "isPackaged";
        } } } });
    const home = new Vue({ store, data: page.data, computed: { ...page.computed,
        settings: () => store.state.app.settings, clashApi: () => api },
        watch: { clashStatus: page.watch.clashStatus }, methods: { ...page.methods,
            createConfigurationRuntime: () => ({ randomizePorts: async () => {} }),
            async initConfigFolder() {}, async loadConfData() {}, loadSettings() {}, initProfilesFolder() {}, loadProfiles() {},
            async detectInterfaceName() {}, async setSSIDOptions() {}, spawnUserDefindExes() {},
            async checkForUpdate() {}, async profileUpdater() {}
        } });
    home.$router = { replace: async () => {} };
    const workflow = createGeneralPageWorkflow({ getLanguage: () => labels, path, yaml, moment: () => ({ format: () => "today" }),
        electron: { ipcRenderer: { invoke: async () => "fixture" } }, cache: { get() {} }, keys: {},
        getNetworkInterfaces: () => [], platform: { isWindows: () => true, isMacOS: () => false, isLinux: () => false }, connectedStatus: connectionStatus.CONNECTED,
        service: { needUpdate: async () => false }, firewall: { status: async () => false }, utilities: {},
        coreConfigRepository: { metadata: async () => ({ geoipModifiedAt: 0 }) }, schedule: callback => callback() });
    const general = createGeneralPage({ defineComponent, Vuex, getLanguage: () => labels, version: "fixture", workflow,
        components: { SelectView: Empty, SwitchView: Empty, SimpleInput: Empty, EscCapture: Empty, InfoIcon: Empty, Hint: Empty },
        platform: {}, shell: {}, fs: {}, yaml, utilities: {}, scheduler: { add() {}, stop() {} } });
    const view = new (Vue.extend({ mixins: [general], computed: { settings: () => store.state.app.settings,
        clashApi: () => api, isWindows: () => true, isMacOS: () => false, isLinux: () => false } }))({ store, parent: home });
    t.after(() => { release(); resumeTap(); view.$destroy(); home.$destroy(); });
    return { home, view, store, connectionStatus, entered, release, workflow, page,
        get writes() { return writes; }, get probes() { return probes; }, respond(value) { ready = value; },
        tapEntered, resumeTap, delayTap() { holdTap = true; } };
}

for (const saved of [{ tun: true, mixin: false }, { tun: false, mixin: true }, { tun: true, mixin: true }, { tun: false, mixin: false }]) {
    test(`General remains visible while restoring saved TUN=${saved.tun}, Mixin=${saved.mixin}`, async t => {
        const h = fixture(t, saved);
        await h.view.setupComponent();
        assert.equal(h.view.port, 7890, "show saved settings before the controller responds");
        assert.equal(h.view.isAllowLan, true);
        const assertPending = () => {
            const rendered = nodes(h.view._render());
            assert.equal(rendered.find(node => node.data?.staticClass === "content")?.data.attrs.inert, "",
                "show settings while retaining the startup edit barrier");
            assert.equal(rendered.some(node => node.componentOptions?.tag === "error-view"), false);
            const switches = rendered.filter(node => node.componentOptions?.tag === "switch-view");
            assert.deepEqual(switches.slice(2, 4).map(node => node.data.attrs.loading), [saved.tun, saved.mixin]);
            assert.ok(switches.slice(2, 4).every(node => node.data.attrs.disabled));
            assert.equal(h.home.proxyBusy, true, "presentation must not release the startup operation lock");
        };
        assertPending();
        h.store.commit("SET_CLASH_STATUS", { status: h.connectionStatus.CONNECTED });
        const applying = h.home.applyStartupProfile();
        await h.entered;
        for (let i = 0; i < 8; i++) { await Vue.nextTick(); assertPending(); }
        assert.equal(h.writes, 1);
        h.release();
        assert.equal((await applying).success, true);
        await h.home.finishStartup(); await Vue.nextTick();
        assert.equal(h.view.tunLoading, false);
        assert.equal(h.view.mixinLoading, false);
        assert.equal(h.home.proxyBusy, false);
        assert.equal(h.writes, 1, "startup status must not enqueue another profile reload");
    });
}

test("General exposes a genuine startup failure after the startup operation settles", async t => {
    const h = fixture(t, { tun: true, mixin: true });
    await h.home.finishStartup(); await Vue.nextTick();
    assert.equal(h.home.proxyBusy, false);
    assert.equal(h.view.tunLoading, false);
    assert.equal(h.view.mixinLoading, false);
    assert.ok(nodes(h.view._render()).some(node => node.componentOptions?.tag === "error-view"));
});

test("saved :53 Mixin keeps only its switch pending until Windows TAP startup finishes after core acceptance", async t => {
    const h = fixture(t, { tun: false, mixin: true });
    h.delayTap();
    h.store.commit("SET_CLASH_STATUS", { status: h.connectionStatus.CONNECTED });
    const applying = h.home.applyStartupProfile();
    await h.entered; h.release(); await h.tapEntered; await Vue.nextTick();
    assert.equal(h.view.tunLoading, false);
    assert.equal(h.view.mixinLoading, true);
    assert.equal(h.home.coreStatusPending, true);
    assert.equal(h.view.coreErrorVisible, false);
    assert.ok(nodes(h.view._render()).some(node => node.data?.staticClass === "content"));
    h.resumeTap(); assert.equal((await applying).success, true);
    await h.home.finishStartup(); await Vue.nextTick();
    assert.equal(h.view.mixinLoading, false);
    assert.equal(h.home.tun2socks.pid, 42);
    assert.equal(h.writes, 1);
});

test("the full startup hook keeps General visible through a slow saved proxy restore without polling it as disconnected", async t => {
    const h = fixture(t, { tun: true, mixin: true });
    let poll;
    t.mock.method(global, "setTimeout", () => ({}));
    t.mock.method(global, "setInterval", (callback, delay) => { if (delay === 3000) poll = callback; return {}; });
    const startup = h.page.beforeMount.call(h.home);
    await h.entered;
    assert.equal(h.store.state.app.clashStatus, h.connectionStatus.CONNECTED, "the startup owner publishes readiness");
    h.respond(false);
    const probes = h.probes;
    for (let i = 0; i < 10; i++) await poll();
    assert.equal(h.probes, probes);
    assert.equal(h.store.state.app.clashStatus, h.connectionStatus.CONNECTED);
    assert.equal(h.view.tunLoading, true);
    assert.equal(h.view.mixinLoading, true);
    assert.ok(nodes(h.view._render()).some(node => node.data?.staticClass === "content"));
    h.respond(true); h.release(); await startup; await Vue.nextTick();
    assert.equal(h.home.proxyBusy, false);
    assert.equal(h.writes, 1);
    assert.equal(h.view.coreErrorVisible, false);
    assert.deepEqual(h.store.state.app.errors, []);
});

test("the full startup hook releases switch progress and exposes an actual readiness timeout", async t => {
    const h = fixture(t, { tun: true, mixin: false });
    t.mock.method(global, "setTimeout", () => ({}));
    t.mock.method(global, "setInterval", () => ({}));
    h.home.waitForCoreReady = async () => false;
    await h.page.beforeMount.call(h.home); await Vue.nextTick();
    assert.equal(h.writes, 0);
    assert.equal(h.view.tunLoading, false);
    assert.equal(h.view.mixinLoading, false);
    assert.equal(h.view.coreErrorVisible, true);
    assert.ok(h.store.state.app.errors.includes(labels.clashCoreFailedStartup()));
});
