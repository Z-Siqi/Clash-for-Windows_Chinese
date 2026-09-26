"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const { homePage } = require("../fixtures/home-page");
const { createRendererConfiguration } = require("../../main/dist/electron/entry/renderer/configuration");
const { buildStore } = require("../fixtures/renderer-store");

test("Application: production startup adapters initialize, load, and preserve a manual mixed port", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-startup-app-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const home = path.join(directory, "data"), assets = path.join(directory, "assets");
    fs.mkdirSync(path.join(assets, "default"), { recursive: true });
    fs.writeFileSync(path.join(assets, "default", "Country.mmdb"), "fixture");
    const { store } = buildStore({ home });
    store.commit("SET_PROFILES_PATH", { path: path.join(home, "profiles") });
    const methods = homePage({
        fs, path, yaml, uuid: { v4: () => "" }, runtimeProcess: { platform: "linux", arch: "x64" },
        utilities: { uQ: async () => false }, getPort: async () => 23456, createRendererConfiguration
    }).methods;
    const model = {
        ...methods, clashPath: home, filesPath: assets,
        get profilesPath() { return store.state.app.profilesPath; },
        get settings() { return store.state.app.settings; },
        get confData() { return store.state.app.confData; },
        setConfData: payload => store.commit("SET_CONF_DATA", payload),
        appendError: payload => store.commit("APPEND_ERROR", payload)
    };
    await model.initConfigFolder(); model.loadConfData(); model.initProfilesFolder(); store.commit("LOAD_PROFILES");
    assert.equal(store.state.app.profiles.index, -1);
    assert.equal(store.state.app.confData["external-controller"], "127.0.0.1:9090");
    fs.writeFileSync(path.join(home, "config.yaml"), "mixed-port: 7894\nexternal-controller: 127.0.0.1:9090");
    model.loadConfData();
    store.commit("SAVE_SETTINGS_OBJECT", { obj: { randomMixedPort: false, randomControllerPort: true } });
    await model.createConfigurationRuntime().randomizePorts(false);
    assert.equal(store.state.app.confData["mixed-port"], 7894);
    assert.equal(store.state.app.confData["external-controller"], "127.0.0.1:23456");
    const reloaded = yaml.parse(fs.readFileSync(path.join(home, "config.yaml"), "utf8"));
    assert.equal(reloaded["mixed-port"], 7894);
    fs.writeFileSync(path.join(home, "config.yaml"), "[broken");
    model.loadConfData();
    assert.equal(store.state.app.errors.length, 1);
    assert.equal(store.state.app.confData["mixed-port"], 7894);
});
