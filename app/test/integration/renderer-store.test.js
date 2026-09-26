"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const cloneDeep = require("../../main/node_modules/lodash/cloneDeep");
const { buildStore } = require("../fixtures/renderer-store");
const { createGlobalMixin } = require("../../main/dist/electron/entry/renderer/global-mixin");
const Vuex = require("../../main/node_modules/vuex");

function temporary(t) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-store-app-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    fs.writeFileSync(path.join(home, "list.yml"), "files: []\nindex: -1");
    return home;
}

test("Application: real Vuex and production module wiring persist settings and profile changes across restart", async t => {
    const home = temporary(t);
    const { store } = buildStore({ home });
    const model = {
        get sts() { return store.state.app.settings; },
        saveSettingsObject: payload => store.commit("SAVE_SETTINGS_OBJECT", payload)
    };
    const mixin = createGlobalMixin({ Vuex, cloneDeep, fs, path, yaml, modifyState: {} });
    const getter = mixin.computed;
    store.commit("SET_SETTINGS_OBJECT", { obj: { proxyCore: "clash", randomMixedPort: true, language: 0 } });
    const first = getter.settings.call(model), second = getter.settings.call(model);
    first.proxyCore = "mihomo"; second.randomMixedPort = false;
    first.connProxyDisconnect = false;
    store.commit("LOAD_PROFILES");
    store.commit("APPEND_PROFILE", { profile: { time: "one.yaml", selected: [{ name: "group", now: "DIRECT" }] } });
    store.commit("CHANGE_PROFILES_INDEX", { index: 0 });
    store.commit("CHANGE_PROFILE", { index: 0, profile: { ...store.state.app.profiles.files[0], mode: "direct" } });
    const restarted = buildStore({ home }).store;
    const loader = mixin.methods;
    loader.loadSettings.call({ clashPath: home, setSettingsObject: payload => restarted.commit("SET_SETTINGS_OBJECT", payload) });
    restarted.commit("LOAD_PROFILES");
    assert.equal(restarted.state.app.settings.proxyCore, "mihomo");
    assert.equal(restarted.state.app.settings.randomMixedPort, false);
    assert.equal(restarted.state.app.settings.connProxyDisconnect, false);
    assert.equal(restarted.state.app.settings.language, 0);
    assert.equal(restarted.state.app.profiles.files[0].mode, "direct");
    assert.equal(restarted.state.app.profiles.index, 0);
    assert.equal(restarted.state.app.profiles.files[0].selected[0].now, "DIRECT");
    assert.equal(await restarted.dispatch("getParserLogPath"), path.join(home, "cfw-parser.log"));
    assert.equal(await restarted.dispatch("getScriptLogPath"), path.join(home, "cfw-script.log"));
});

test("Application: failed settings and profiles writes leave Vuex and saved files unchanged", t => {
    const home = temporary(t);
    const { store } = buildStore({ home, fileSystem: { ...fs, renameSync() { throw Error("disk locked"); } } });
    store.commit("SET_SETTINGS_OBJECT", { obj: { proxyCore: "clash" } }); store.commit("LOAD_PROFILES");
    assert.throws(() => store.commit("SAVE_SETTINGS_OBJECT", { obj: { proxyCore: "mihomo" } }), /disk locked/);
    assert.equal(store.state.app.settings.proxyCore, "clash");
    assert.throws(() => store.commit("APPEND_PROFILE", { profile: { time: "new.yaml" } }), /disk locked/);
    assert.equal(store.state.app.profiles.files.length, 0);
    assert.equal(yaml.parse(fs.readFileSync(path.join(home, "list.yml"), "utf8")).files.length, 0);
    assert.deepEqual(fs.readdirSync(home), ["list.yml"]);
});

test("Application: SSID overrides remain temporary; ordinary TUN/mixin preferences restore", t => {
    const home = temporary(t);
    const h = buildStore({ home });
    h.store.commit("CHANGE_IS_TUN_ENABLE", { isTun: true });
    h.store.commit("CHANGE_IS_MIXIN_ENABLE", { isMixin: true });
    h.store.commit("SET_IS_SYSTEM_PROXY_ON", { isOn: true });
    h.store.commit("SET_MATCHED_SSID", { ssid: "temporary-network" });
    h.store.commit("CHANGE_IS_TUN_ENABLE", { isTun: false });
    h.store.commit("CHANGE_IS_MIXIN_ENABLE", { isMixin: false });
    h.store.commit("SET_IS_SYSTEM_PROXY_ON", { isOn: false });
    assert.equal(h.modifyState.isTun, false); assert.equal(h.modifyState.isMixin, false);
    const restarted = buildStore({ home, storage: h.storage }).store;
    assert.equal(restarted.state.app.isTunEnable, true);
    assert.equal(restarted.state.app.isMixinEnable, true);
    assert.equal(restarted.state.app.isSystemProxyOn, true);
});

test("Application: Vuex uses semantic API and changes mode only after successful responses", async t => {
    const home = temporary(t); let code = 204; const requests = [];
    const { store } = buildStore({ home, axios: { create: () => ({
        patch: async (url, data) => { requests.push([url, data]); return { status: code }; },
        get: async () => ({ status: 200, data: { mode: "global" } })
    }) } });
    store.commit("SET_CONF_DATA", { data: { "external-controller": "127.0.0.1:12345", "mixed-port": 7891 } });
    await store.dispatch("setMode", { mode: "direct" }); assert.equal(store.state.app.mode, "direct");
    code = 500; await store.dispatch("setMode", { mode: "rule" }); assert.equal(store.state.app.mode, "direct");
    await store.dispatch("getMode"); assert.equal(store.state.app.mode, "global");
    assert.equal(requests[0][0], "/configs"); assert.deepEqual(requests[0][1], { mode: "direct" });
    assert.equal(store.getters.mixedPort, 7891);
    assert.equal(store.getters.controllerPort, 12345);
});
