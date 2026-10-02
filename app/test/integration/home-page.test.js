"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const getPort = require("../../main/node_modules/get-port");
const { homePage } = require("../fixtures/home-page");
const { assertRendererComposition } = require("../fixtures/assert-renderer-composition");

test("Home traffic subscribes with injected paths and renders Enhanced Tray frames", () => {
    let messageHandler;
    let terminated = 0;
    const sends = [];
    const page = homePage({ electron: { ipcRenderer: { send: (...args) => sends.push(args) } } });
    const traffic = page.components.MainMenu.components.ClashTrafficView;
    const drawing = new Proxy({}, { get: (_target, key) => key === "measureText" ? () => ({ width: 10 }) : () => {} });
    const model = {
        ...traffic.methods, ...traffic.data(), isWindowShow: true, trayDisabled: false,
        resourcesPath: "fixture", mode: "rule", colors: ["#000", "#fff"],
        settings: { trayOrders: [["traffic"], []] },
        canvas: { getContext: () => drawing, toDataURL: () => "data:image/png;base64,fixture", width: 10000, height: 69 },
        iconImage: source => ({ source }),
        clashWSClient: () => ({ on(_event, callback) { messageHandler = callback; }, terminate() { terminated++; } })
    };
    model.setupRequest();
    assert.equal(model.trayIconImg.source, path.join("fixture", "static/imgs/logo_64_eyes.png"));
    messageHandler('{"up":1024,"down":2048}');
    assert.deepEqual(model.speed, { up: 1024, down: 2048 });
    assert.equal(sends.at(-1)[0], "speed-update");
    assert.equal(sends.at(-1)[2], 150);
    model.stopRequest();
    assert.equal(terminated, 1);
    assert.equal(model.client, null);
    assert.deepEqual(traffic.computed.colors.call({ theme: "mc" }), ["#2c2a38", "#ffffff"]);
});

test("Home page: extracted owner includes dashboard shell and local child components", () => {
    const page = homePage();
    assert.equal(page.name, "landing-page");
    assert.equal(page._scopeId, "data-v-68cbbc92");
    assert.equal(page.components.MainMenu._scopeId, "data-v-149ea1bd");
    assert.equal(page.components.StatusBar._scopeId, "data-v-65878d23");
    assert.equal(page.components.MainMenu.components.ClashTrafficView._scopeId, "data-v-4f5120b9");
    assert.equal(page.components.MainMenu.components.RunTimeView._scopeId, "data-v-05e7144a");
});

test("Home page: core lifecycle uses the injected client without constructing native capabilities", () => {
    const calls = [];
    const page = homePage({
        createClashCoreRuntime: value => { calls.push(value); return { marker: true }; },
        createClashServiceApi: value => ({ serviceClient: value.client }),
        childProcess: { spawn() {} }, fs: { marker: "fs" }, path: { marker: "path" },
        httpClient: { marker: "axios" }, logger: { transports: { console: {}, file: {} } }
    });
    const runtime = page.methods.createClashCoreRuntime();
    assert.equal(runtime.marker, true);
    assert.deepEqual(calls, [undefined]);
});

test("Home page: production entry delegates to the named factory", () => {
    assertRendererComposition("createHomePage", [
        "createHomePageComponents", "createHomePageOptions", "renderHomePage"
    ]);
});

test("Home page: occupied mixed port dialog can select, verify, and persist a random port", async () => {
    const writes = [], commits = [], patches = [];
    let selectedPort = 0;
    const page = homePage({
        net,
        getPort,
        showMessageBox: async options => {
            assert.equal(options.buttons.length, 3);
            return { response: 1 };
        },
        updateYaml: async (...args) => writes.push(args),
        sleep: async () => {},
        notify() {}
    });
    const model = {
        ...page.methods,
        isResolvingMixedPortConflict: false,
        clashMixedPort: 0,
        mixedPort: 7890,
        clashPath: "profile",
        confData: { mode: "rule", "mixed-port": 7890 },
        settings: { randomMixedPort: false },
        clashApi: {
            async patchConfig(value) { selectedPort = value["mixed-port"]; patches.push(value); return { status: 204 }; },
            async getConfig() { return { status: 200, data: { "mixed-port": selectedPort } }; }
        },
        setConfData: payload => commits.push(payload)
    };

    await model.resolveMixedPortConflict();

    assert.ok(selectedPort > 0);
    assert.equal(model.clashMixedPort, selectedPort);
    assert.deepEqual(patches, [{ "mixed-port": selectedPort }]);
    assert.deepEqual(writes, [[path.join("profile", "config.yaml"), "mixed-port", selectedPort]]);
    assert.equal(commits[0].data["mixed-port"], selectedPort);
});

test("Home page: occupied mixed port dialog accepts a checked manual port", async () => {
    const manualPort = await getPort();
    const writes = [], commits = [];
    let selectedPort = 0;
    const page = homePage({
        net,
        showMessageBox: async () => ({ response: 0 }),
        updateYaml: async (...args) => writes.push(args),
        sleep: async () => {},
        notify() {}
    });
    const model = {
        ...page.methods,
        isResolvingMixedPortConflict: false,
        clashMixedPort: 0,
        mixedPort: 7890,
        clashPath: "profile",
        confData: { "mixed-port": 7890 },
        settings: { randomMixedPort: true },
        $input: async () => ({ port: String(manualPort) }),
        clashApi: {
            async patchConfig(value) { selectedPort = value["mixed-port"]; return { status: 204 }; },
            async getConfig() { return { status: 200, data: { "mixed-port": selectedPort } }; }
        },
        setConfData: payload => commits.push(payload)
    };

    await model.resolveMixedPortConflict();

    assert.equal(selectedPort, manualPort);
    assert.equal(model.settings.randomMixedPort, false);
    assert.deepEqual(writes, [[path.join("profile", "config.yaml"), "mixed-port", manualPort]]);
    assert.equal(commits[0].data["mixed-port"], manualPort);
});

test("Home page: restart transients cannot open the mixed-port recovery dialog", async () => {
    const page = homePage({ sleep: async () => {} });
    let probes = 0;
    let dialogs = 0;
    const model = {
        ...page.methods,
        isCoreRestarting: true,
        isResolvingMixedPortConflict: false,
        clashStatus: "connected",
        clashMixedPort: 0,
        clashApi: {
            getConfig: async () => {
                probes += 1;
                return { status: 200, data: { "mixed-port": 0 } };
            }
        },
        resolveMixedPortConflict: async () => { dialogs += 1; }
    };

    assert.equal(await model.checkMixedPortConflict(), false);
    model.isCoreRestarting = false;
    model.clashStatus = "disconnected";
    assert.equal(await model.checkMixedPortConflict(), false);
    assert.equal(probes, 0);
    assert.equal(dialogs, 0);

    model.clashStatus = "connected";
    assert.equal(await model.checkMixedPortConflict(), true);
    assert.equal(probes, 3);
    assert.equal(dialogs, 1);
});

test("Home page: routing mode changes publish both the tray image and menu mode", async () => {
    const page = homePage();
    const calls = [];
    const model = {
        updateTrayIcon: () => calls.push("icon"),
        settings: { connMode: false },
        profiles: { files: [], index: -1 },
        changeProfile() {},
        clashApi: { closeConnections: async () => {} }
    };
    const modePage = homePage({
        electron: {
            ipcRenderer: { send: (...args) => calls.push(args), invoke: async () => false, on() {} },
            shell: {}
        }
    });
    await modePage.watch.mode.handler.call(model, "global");
    assert.deepEqual(calls, ["icon", ["mode-changed", "global"]]);
});
