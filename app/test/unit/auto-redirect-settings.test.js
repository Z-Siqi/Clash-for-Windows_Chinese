"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const yaml = require("../../main/node_modules/yaml");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createGeneralPage } = require("../../main/dist/electron/features/clash-core/general-page");
const { buildTunConfig } = require("../../main/dist/electron/features/tun/build-tun-config");
const { createProfileApplication } = require("../../main/dist/electron/features/profiles/profile-application");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

Vue.use(Vuex);
function view(saved, core = "mihomo", language = 1) {
    const writes = [], confirmations = [], state = { settings: { proxyCore: core }, tunSettings: saved };
    const store = new Vuex.Store({ state: { app: state }, mutations: { SET_TUN_SETTINGS(app, { settings }) { app.app.tunSettings = settings; writes.push(settings); } } });
    const component = createGeneralPage({ defineComponent, Vuex, getLanguage: () => createTranslator(language), components: {},
        workflow: { computed: {}, methods: {} }, platform: { isWindows: () => false, isMacOS: () => false }, shell: {}, yaml,
        utilities: { buildTunConfig: (settings, selected) => buildTunConfig(settings, "linux", selected) } }).components.TunSettingsView;
    const vm = new (Vue.extend({ ...component, computed: { ...component.computed, isLinux: () => true } }))({ store });
    vm.setupComponent(saved || {});
    let closes = 0;
    vm.$on("close", () => closes++);
    vm.$select = async options => { confirmations.push(options); return [0]; };
    return { vm, store, writes, confirmations, get closes() { return closes; } };
}

test("Linux core-aware TUN config never migrates old ignored Auto Redir choices into Mihomo activation", () => {
    const legacy = { isAutoRedir: true, isAutoRedirAutoRoute: false };
    for (const core of [undefined, "mihomo"]) {
        const pending = buildTunConfig(legacy, "linux", core);
        assert.equal(Object.hasOwn(pending, "auto-redir"), false);
        assert.equal(Object.hasOwn(pending.tun, "auto-redirect"), false);
        for (const enabled of [true, false]) {
            const explicit = buildTunConfig({ ...legacy, mihomoAutoRedirect: enabled }, "linux", core);
            assert.equal(explicit.tun["auto-redirect"], enabled);
            assert.equal(explicit.tun["auto-route"], true);
        }
    }
    const clash = buildTunConfig({ ...legacy, mihomoAutoRedirect: true }, "linux", "clash");
    assert.deepEqual(clash["auto-redir"], { enable: true, "auto-route": false });
    assert.equal(Object.hasOwn(clash.tun, "auto-redirect"), false);
    for (const platform of ["darwin", "win32"]) assert.equal(Object.hasOwn(buildTunConfig({ mihomoAutoRedirect: true }, platform).tun, "auto-redirect"), false);
});

test("historical Linux Auto Redir is shown disabled for Mihomo and unrelated saves retain Clash choices", async () => {
    const h = view({ isAutoRedir: true, isAutoRedirAutoRoute: true });
    assert.equal(h.vm.autoRedirEnabled, false);
    assert.equal(h.vm.mihomoAutoRedirect, null);
    assert.equal(await h.vm.handleSave(), true);
    assert.equal(h.confirmations.length, 0);
    assert.equal(h.writes[0].isAutoRedir, true);
    assert.equal(h.writes[0].isAutoRedirAutoRoute, true);
    assert.equal(Object.hasOwn(h.vm.obj.tun, "auto-redirect"), false);
    h.vm.$destroy();
});

test("Mihomo Auto Redir activation requires confirmation; cancel or dismissal leaves persisted settings intact", async () => {
    for (const outcome of ["confirm", "cancel", "dismiss"]) {
        const h = view({ isAutoRedir: true, isAutoRedirAutoRoute: false });
        h.vm.autoRedirEnabled = true;
        if (outcome === "cancel") h.vm.$select = async () => [1];
        if (outcome === "dismiss") h.vm.$select = async () => { throw Error("dismissed"); };
        assert.equal(await h.vm.handleSave(), outcome === "confirm");
        assert.equal(h.writes.length, outcome === "confirm" ? 1 : 0);
        assert.equal(h.closes, outcome === "confirm" ? 1 : 0);
        if (outcome === "confirm") {
            assert.match(h.confirmations[0].message, /VPN/);
            assert.equal(h.writes[0].mihomoAutoRedirect, true);
            assert.equal(h.writes[0].isAutoRedirAutoRoute, false);
            assert.equal(h.vm.obj.tun["auto-route"], true);
            await h.vm.handleSave();
            assert.equal(h.confirmations.length, 1, "confirmed settings are not re-prompted");
        } else assert.equal(h.store.state.app.tunSettings.mihomoAutoRedirect, undefined);
        h.vm.$destroy();
    }
});

test("reset preserves the other core's choices and confirmation cannot commit across busy/core changes", async () => {
    const h = view({ isAutoRedir: true, isAutoRedirAutoRoute: true, mihomoAutoRedirect: true });
    h.vm.handleReset();
    assert.equal(h.vm.isAutoRedir, true); assert.equal(h.vm.isAutoRedirAutoRoute, true);
    assert.equal(h.vm.mihomoAutoRedirect, null);
    h.store.state.app.settings.proxyCore = "clash";
    h.vm.mihomoAutoRedirect = true; h.vm.handleReset();
    assert.equal(h.vm.isAutoRedir, false); assert.equal(h.vm.mihomoAutoRedirect, true);
    h.store.state.app.settings.proxyCore = "mihomo";
    h.store.state.app.tunSettings = {};
    h.vm.$select = async () => { h.store.state.app.settings.proxyCore = "clash"; return [0]; };
    assert.equal(await h.vm.handleSave(), false); assert.equal(h.writes.length, 0);
    h.vm.$destroy();
});

test("closing a TUN editor or repeated Save while confirmation is pending cannot activate Auto Redir", async () => {
    const h = view({});
    let finish;
    h.vm.autoRedirEnabled = true;
    h.vm.$select = () => new Promise(resolve => { finish = resolve; });
    const saving = h.vm.handleSave();
    assert.equal(await h.vm.handleSave(), false);
    h.vm.$destroy();
    finish([0]);
    assert.equal(await saving, false);
    assert.equal(h.writes.length, 0);
});

test("a network operation beginning during confirmation leaves Auto Redir settings unsaved", async () => {
    const h = view({}), parent = new Vue({ data: () => ({ proxyBusy: false }) });
    h.vm.$parent = parent;
    h.vm.autoRedirEnabled = true;
    h.vm.$select = async () => { parent.proxyBusy = true; return [0]; };
    assert.equal(await h.vm.handleSave(), false);
    assert.equal(h.writes.length, 0);
    h.vm.$destroy(); parent.$destroy();
});

test("final Linux Mihomo configuration rejects unsupported redirect/route combinations before touching the core", async () => {
    for (const language of [0, 1]) for (const core of ["clash", "mihomo"]) {
        const calls = [], labels = createTranslator(language);
        const apply = createProfileApplication({ platform: "linux", yaml, getLanguage: () => labels, messages: {},
            readProfileSource: async () => "rules: [MATCH,DIRECT]\n", effects: { setPayload() {}, setProvidersVisible() {}, resetDns() {}, stopTap() {} },
            clashApi: { putConfig: async payload => { calls.push(yaml.parse(payload.payload)); return { status: 204 }; } } });
        const settings = { proxyCore: core, mixinType: 0, mixinText: "mixin:\n  tun:\n    enable: true\n    auto-redirect: true\n    auto-route: false\n" };
        const result = await apply({ profiles: { index: 0, files: [{ time: "one.yaml" }] }, settings, mixinEnabled: true });
        if (core === "mihomo") {
            assert.equal(result.success, false); assert.equal(calls.length, 0);
            assert.ok(result.message.includes(labels.autoRedirectNeedsAutoRoute()));
        } else assert.equal(calls.length, 1);
    }
});
