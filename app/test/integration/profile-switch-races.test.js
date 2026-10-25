"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const { refreshProfile, refreshTapAfterSetup } = require("../../main/dist/electron/entry/renderer/refresh-profile");
const { buildStore } = require("../fixtures/renderer-store");
const { profilePage } = require("../fixtures/profile-pages");
const { homePage } = require("../fixtures/home-page");
const { createTunRuntime } = require("../../main/dist/electron/features/tun/tun-runtime");
const { createTunClient } = require("../../main/dist/electron/core/native/tun-client");
const { createNativeAdminClient } = require("../../main/dist/electron/core/native/native-admin-client");
const { registerNativeAdminIpc } = require("../../main/dist/electron/entry/main/register-native-admin-ipc");

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function fixture(t, overrides = {}, pageOptions = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-profile-race-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const sources = ["interface-name: Ethernet\ndns: { enable: true, listen: ':53' }\nrules: ['MATCH,DIRECT']\n",
        "dns: { enable: false }\nrules: ['MATCH,REJECT']\n"];
    fs.writeFileSync(path.join(directory, "list.yml"), "index: -1\nfiles:\n  - time: tap.yaml\n  - time: plain.yaml\n");
    for (const [index, name] of ["tap.yaml", "plain.yaml"].entries()) fs.writeFileSync(path.join(directory, name), sources[index]);
    const { store } = buildStore({ home: directory });
    store.commit("LOAD_PROFILES");
    const payloads = [], events = [], dialogs = [];
    const model = {
        get profiles() { return store.state.app.profiles; }, profilesPath: directory,
        get settings() { return store.state.app.settings; }, confData: {}, menuItems: [],
        clashApi: {
            async putConfig({ payload }) { payloads.push(yaml.parse(payload)); return { status: 204 }; },
            async closeConnections() { events.push("closeConnections"); }
        },
        setCurrentProfilePayload({ payload }) { this.currentProfilePayload = payload; },
        setMenuItems({ items }) { this.menuItems = items; },
        resetDNS() { events.push("resetDns"); },
        spawnTun2socks() { events.push("startTap"); this.tun2socks = { pid: 123 }; },
        killSpawned(processHandle) { if (processHandle) events.push("stopTap"); }
    };
    model.settings.legacyTapMode = "enabled";
    const dependencies = { fs, path, yaml, platform: "win32", messages: {},
        profileNetworkEffects: { hasTap: () => true }, ...overrides };
    model.refreshProfile = () => refreshProfile(model, dependencies);
    const page = profilePage({ store, parent: model, dialogs, ...pageOptions });
    return { page, model, dependencies, payloads, events, dialogs, store };
}

test("a :53 profile TAP failure restores the completed profile selection and core payload", async t => {
    const h = fixture(t);
    assert.equal(await h.page.switchProfile(1), true);
    h.model.spawnTun2socks = async () => { throw Error("route unavailable"); };
    assert.equal(await h.page.switchProfile(0), false);
    assert.equal(h.store.state.app.profiles.index, 1);
    assert.equal(h.model.currentProfilePayload.dns.enable, false);
    assert.deepEqual(h.payloads.map(payload => payload.dns.enable), [false, true, false]);
    assert.match(h.dialogs[0].detail, /route unavailable/);
    assert.deepEqual(h.page.loadingProfileIndex, []);
});

test("a :53 profile TAP failure retains the accepted selection when the controller rejects compensation", async t => {
    const h = fixture(t);
    await h.page.switchProfile(1);
    const putConfig = h.model.clashApi.putConfig;
    h.model.clashApi.putConfig = async payload => h.payloads.length === 2 ? { status: 500 } : putConfig(payload);
    h.model.spawnTun2socks = async () => { throw Error("route unavailable"); };
    assert.equal(await h.page.switchProfile(0), false);
    assert.equal(h.store.state.app.profiles.index, 0);
    assert.equal(h.model.currentProfilePayload.dns.listen, ":53");
    assert.match(h.dialogs[0].detail, /500/);
});

test("failed switching between :53 profiles restarts only the restored profile's TAP process", async t => {
    const h = fixture(t);
    await h.page.switchProfile(0);
    fs.writeFileSync(path.join(h.model.profilesPath, "other.yaml"), "interface-name: Ethernet\ndns: {enable: true, listen: ':53', nameserver: [9.9.9.9]}\nrules: ['MATCH,REJECT']\n");
    h.store.commit("APPEND_PROFILE", { profile: { time: "other.yaml" } });
    let starts = 0;
    h.model.spawnTun2socks = async () => {
        if (++starts === 1) { h.model.tun2socks = null; throw Error("new TAP failed"); }
        h.model.tun2socks = { pid: 200 };
    };
    assert.equal(await h.page.switchProfile(2), false);
    assert.equal(h.store.state.app.profiles.index, 0);
    assert.equal(h.model.tun2socks.pid, 200);
    assert.equal(starts, 2);
    assert.deepEqual(h.model.currentProfilePayload.rules, ["MATCH,DIRECT"]);
    assert.equal(h.model.currentProfilePayload.dns.nameserver, undefined);
    assert.deepEqual(h.payloads.map(payload => payload.rules[0]), ["MATCH,DIRECT", "MATCH,REJECT", "MATCH,DIRECT"]);
});

test("TAP started by a completed installation is also restarted when a later :53 profile fails", async t => {
    let installed = false;
    const h = fixture(t, { profileNetworkEffects: { hasTap: async () => installed } });
    await h.page.switchProfile(0);
    assert.equal(h.model.tun2socks, null);
    h.model.clashStatus = "connected"; installed = true;
    await refreshTapAfterSetup(h.model, { connectedStatus: "connected" }, true);
    assert.ok(h.model.tun2socks);
    let attempts = 0;
    h.model.spawnTun2socks = async () => {
        if (++attempts === 1) { h.model.tun2socks = null; throw Error("next startup failed"); }
        h.model.tun2socks = { pid: 201 };
    };
    assert.equal(await h.page.switchProfile(0), false);
    assert.equal(attempts, 2);
    assert.equal(h.model.tun2socks.pid, 201);
    assert.equal(h.model.profiles.index, 0);
});

test("updating an active subscription without :53 stops TAP through manual and scheduled update paths", async t => {
    for (const trigger of ["manual", "scheduled"]) {
        await t.test(trigger, async () => {
            let state;
            const downloadProfile = async () => {
                fs.writeFileSync(path.join(state.model.profilesPath, "tap.yaml"), "dns: { enable: true, listen: '127.0.0.1:1053' }\nrules: ['MATCH,DIRECT']\n");
                return { success: true, targetIndex: 0 };
            };
            state = fixture(t, {}, { downloadProfile });
            state.model.profiles.files[0].url = "https://fixture.test/profile";
            state.model.profiles.files[0].interval = 1;
            assert.equal(await state.page.switchProfile(0), true);
            assert.ok(state.model.tun2socks);
            if (trigger === "manual") await state.page.updateConfig({ url: "https://fixture.test/profile" });
            else {
                Object.assign(state.model, { profileUpdateFailed: {}, profileUpdateFailedURLs: [] });
                await homePage({ downloadProfile, moment: require("../../main/node_modules/moment"), profileFiles: {
                    async modificationTimes() { return { "tap.yaml": new Date(0) }; }, async cleanupOrphans() {}
                } }).methods.profileUpdater.call(state.model);
            }
            assert.equal(state.model.profiles.index, 0);
            assert.equal(state.model.currentProfilePayload.dns.listen, "127.0.0.1:1053");
            assert.equal(state.model.tun2socks, null);
            assert.deepEqual(state.events.filter(event => /Tap$/.test(event)), ["startTap", "stopTap"]);
            assert.equal(state.payloads.length, 2);
            assert.deepEqual(state.dialogs, []);
        });
    }
});

test("subscription DNS removal respects final Mixin DNS and preserves TAP on a rejected update", async t => {
    for (const scenario of ["missing-dns", "retained-mixin", "rejected"]) {
        await t.test(scenario, async () => {
            let state;
            state = fixture(t, {}, { downloadProfile: async () => {
                fs.writeFileSync(path.join(state.model.profilesPath, "tap.yaml"), "rules: ['MATCH,DIRECT']\n");
                return { success: true, targetIndex: 0 };
            } });
            if (scenario === "retained-mixin") {
                state.model.settings.legacyTapMode = "mixin";
                state.model.isMixinEnable = true;
                state.model.settings.mixinText = "mixin:\n  interface-name: Ethernet\n  dns: { enable: true, listen: ':53' }\n";
            }
            assert.equal(await state.page.switchProfile(0), true);
            const accepted = state.model.currentProfilePayload;
            if (scenario === "rejected") state.model.clashApi.putConfig = async () => ({ status: 400, data: { message: "rejected" } });
            await state.page.updateConfig({ url: "https://fixture.test/profile" });
            assert.equal(!!state.model.tun2socks, scenario !== "missing-dns");
            if (scenario === "rejected") assert.equal(state.model.currentProfilePayload, accepted);
            else assert.equal(state.model.currentProfilePayload.dns?.listen, scenario === "retained-mixin" ? ":53" : undefined);
            assert.equal(state.dialogs.length, scenario === "rejected" ? 1 : 0);
        });
    }
});

test("an update removing :53 cancels pending TAP startup even when the selected profile identity stays the same", async t => {
    const entered = deferred();
    let state;
    state = fixture(t, {}, { downloadProfile: async () => {
        fs.writeFileSync(path.join(state.model.profilesPath, "tap.yaml"), "dns: { enable: false }\n");
        return { success: true, targetIndex: 0 };
    } });
    let canceled = false;
    state.model.spawnTun2socks = async ({ signal }) => {
        entered.resolve();
        await new Promise(resolve => signal.addEventListener("abort", () => { canceled = true; resolve(); }, { once: true }));
    };
    const starting = state.page.switchProfile(0);
    await entered.promise;
    await Promise.all([starting, state.page.updateConfig({ url: "https://fixture.test/profile" })]);
    assert.equal(canceled, true);
    assert.equal(state.model.profiles.index, 0);
    assert.equal(state.model.currentProfilePayload.dns.enable, false);
    assert.equal(state.model.tun2socks, null);
    assert.equal(state.payloads.length, 2);
    assert.deepEqual(state.dialogs, []);
});

test("manual profile clicks keep the first selection locked through TAP startup and accept a new selection after completion", async t => {
    const state = fixture(t), entered = deferred(), ready = deferred();
    const methods = homePage().methods;
    Object.assign(state.model, { proxyOperation: "", runProxyOperation: methods.runProxyOperation,
        requestProfileSelection: methods.requestProfileSelection, publishProxyState() {}, publishProxyOperation() {} });
    Object.defineProperty(state.model, "proxyBusy", { get() { return !!this.proxyOperation; } });
    state.model.spawnTun2socks = async () => { entered.resolve(); await ready.promise; state.model.tun2socks = { pid: 200 }; };
    const first = state.page.handleProfileClick(0);
    await entered.promise;
    for (let index = 0; index < 20; index++) assert.equal(await state.page.handleProfileClick(1), false);
    assert.equal(state.store.state.app.profiles.index, 0);
    assert.deepEqual(state.page.loadingProfileIndex, [0]);
    assert.equal(state.payloads.length, 1);
    ready.resolve();
    assert.equal(await first, true);
    assert.equal(state.model.proxyBusy, false);
    assert.deepEqual(state.page.loadingProfileIndex, []);
    assert.equal(await state.page.handleProfileClick(1), true);
    assert.equal(state.store.state.app.profiles.index, 1);
    assert.equal(state.model.tun2socks, null);
});

test("the click entry blocks other cards synchronously even if parent busy state stays stale", async t => {
    const h = fixture(t), entered = deferred(), finish = deferred();
    // A parent callback alone is not a reliable input lock. Keep its busy flag
    // deliberately stale to exercise the local reservation before Vue paints.
    h.model.proxyBusy = false;
    h.model.spawnTun2socks = async () => { entered.resolve(); await finish.promise; h.model.tun2socks = { pid: 200 }; };
    const first = h.page.handleProfileClick(0);
    for (let index = 0; index < 50; index++) assert.equal(await h.page.handleProfileClick(1), false);
    await entered.promise;
    assert.equal(await h.page.switchProfile(1), false, "a second entry must not bypass the click reservation");
    h.page.dragSelectedName = "plain.yaml";
    h.page.handleDragEnd();
    assert.equal(h.model.profiles.index, 0);
    assert.equal(h.payloads.length, 1);
    finish.resolve();
    assert.equal(await first, true);
    assert.equal(h.model.profiles.index, 0);
    assert.equal(await h.page.handleProfileClick(1), true);
    assert.equal(h.model.profiles.index, 1);
});

test("a rejected parent reservation releases the click latch for the next user action", async t => {
    const h = fixture(t);
    h.model.requestProfileSelection = () => { throw Error("cannot reserve"); };
    await assert.rejects(h.page.handleProfileClick(0), /cannot reserve/);
    h.model.requestProfileSelection = action => action();
    assert.equal(await h.page.handleProfileClick(1), true);
});

test("a background profile apply also blocks manual clicks until it finishes", async t => {
    const h = fixture(t), entered = deferred(), finish = deferred();
    h.model.proxyBusy = false;
    h.model.spawnTun2socks = async () => { entered.resolve(); await finish.promise; h.model.tun2socks = { pid: 200 }; };
    const background = h.page.switchProfile(0);
    await entered.promise;
    assert.equal(await h.page.handleProfileClick(1), false);
    assert.equal(h.model.profiles.index, 0);
    finish.resolve(); await background;
    assert.equal(await h.page.handleProfileClick(1), true);
});

test("rapid TAP/plain profile selections discard obsolete queued refreshes and apply only the last choice", async t => {
    for (const lastIndex of [0, 1]) {
        const entered = deferred(), read = deferred();
        let reads = 0;
        const fixtureState = fixture(t, { async readProfileSource(directory, name) {
            if (++reads === 1) { entered.resolve(); await read.promise; }
            return fs.readFileSync(path.join(directory, name), "utf8");
        } });
        const requests = [fixtureState.page.switchProfile(0)];
        await entered.promise;
        for (let index = 0; index < 20; index++) requests.push(fixtureState.page.switchProfile(index % 2));
        requests.push(fixtureState.page.switchProfile(lastIndex));
        read.resolve();
        await Promise.all(requests);
        assert.equal(fixtureState.payloads.length, 1, "only the latest selection may reach the core");
        assert.equal(!!fixtureState.model.currentProfilePayload.dns.enable, lastIndex === 0);
        assert.equal(!!fixtureState.model.tun2socks, lastIndex === 0);
        assert.equal(fixtureState.events.filter(event => event === "startTap").length, lastIndex === 0 ? 1 : 0);
        assert.equal(fixtureState.store.state.app.profiles.index, lastIndex);
        assert.deepEqual(fixtureState.dialogs, []);
        assert.deepEqual(fixtureState.page.loadingProfileIndex, []);
    }
});

test("rapid selections still obey disabled and strict Mixin-only TAP permission", async t => {
    for (const [mode, authorize, expectedTap] of [["disabled", true, false], ["mixin", false, false], ["mixin", true, true]]) {
        const entered = deferred(), read = deferred();
        let reads = 0;
        const fixtureState = fixture(t, { async readProfileSource(directory, name) {
            if (++reads === 1) { entered.resolve(); await read.promise; }
            return fs.readFileSync(path.join(directory, name), "utf8");
        } });
        fixtureState.model.settings.legacyTapMode = mode;
        fixtureState.model.settings.mixinType = 1;
        fixtureState.model.settings.mixinCode = "fixture";
        fixtureState.model.isMixinEnable = true;
        fixtureState.dependencies.runMixin = async ({ content }) => authorize ? { ...content, "cfw-tap": true } : content;
        const first = fixtureState.page.switchProfile(0);
        await entered.promise;
        const middle = fixtureState.page.switchProfile(1);
        const last = fixtureState.page.switchProfile(0);
        read.resolve();
        await Promise.all([first, middle, last]);
        assert.equal(fixtureState.payloads.length, 1);
        assert.equal(!!fixtureState.model.tun2socks, expectedTap, `${mode}/${authorize}`);
        assert.equal(Object.hasOwn(fixtureState.model.currentProfilePayload, "cfw-tap"), false);
        assert.equal(fixtureState.store.state.app.profiles.index, 0);
        assert.deepEqual(fixtureState.dialogs, []);
    }
});

test("closing an old error dialog cannot clear or open the editor for a newer A -> B -> A choice", async t => {
    const shown = deferred(), dismiss = deferred(), entered = deferred(), applied = deferred();
    const fixtureState = fixture(t, {}, { respondToDialog() { shown.resolve(); return dismiss.promise; } });
    fixtureState.model.clashApi.putConfig = async ({ payload }) => {
        fixtureState.payloads.push(yaml.parse(payload));
        if (fixtureState.payloads.length === 1) return { status: 400, data: { message: "first attempt rejected" } };
        if (fixtureState.payloads.length === 3) { entered.resolve(); await applied.promise; }
        return { status: 204 };
    };
    const oldSelection = fixtureState.page.switchProfile(0);
    await shown.promise;
    await fixtureState.page.switchProfile(1);
    const lastSelection = fixtureState.page.switchProfile(0);
    await entered.promise;
    dismiss.resolve({ response: 1 });
    await oldSelection;
    assert.equal(fixtureState.store.state.app.profiles.index, 0);
    assert.equal(fixtureState.payloads.length, 3, "the newest background refresh is still in flight");
    applied.resolve();
    await lastSelection;
    assert.equal(fixtureState.model.currentProfilePayload.dns.enable, true);
    assert.equal(fixtureState.dialogs.length, 1);
    assert.deepEqual(fixtureState.page.loadingProfileIndex, []);
});

test("profile cancellation crosses native IPC and kills pending TAP startup before adding a default route", async t => {
    const waiting = deferred(), resume = deferred(), commands = [];
    const fixtureState = fixture(t);
    let ready = false, nextPid = 100;
    const directory = fixtureState.model.profilesPath;
    const resourcesPath = path.join(directory, "resources"), filesPath = path.join(resourcesPath, "static", "files");
    const mainWindow = { webContents: { mainFrame: {} } };
    const event = { sender: mainWindow.webContents, senderFrame: mainWindow.webContents.mainFrame };
    let handler;
    registerNativeAdminIpc({
        ipcMain: { handle(_channel, callback) { handler = callback; } },
        app: { once() {}, isPackaged: true, getPath: name => name === "home" ? directory : path.join(directory, "app.exe") },
        getMainWindow: () => mainWindow, fs: {}, path, platform: "win32", arch: "x64", resourcesPath,
        sudoPrompt: { exec() { assert.fail("TAP elevation is outside this test"); } },
        createTapRuntime: options => createTunRuntime({ ...options, logger: { info() {} }, sleep() { waiting.resolve(); return resume.promise; } }),
        childProcess: {
            spawn() { const processHandle = { pid: ++nextPid }; commands.push(["spawn", processHandle.pid]); return processHandle; },
            execFile(command, argumentsList, _options, callback) {
                commands.push([command, ...argumentsList]);
                callback(null, command === "route" && argumentsList[0] === "print" && ready
                    ? "10.0.0.0 255.255.255.0 On-link 10.0.0.1 257\n0.0.0.0 0.0.0.0 10.0.0.0 10.0.0.1 2" : "");
            }
        }
    });
    const native = createNativeAdminClient({
        ipcRenderer: { invoke(_channel, scope, action, payload) { return handler(event, scope, action, structuredClone(payload)); } },
        getClashPath: () => path.join(directory, ".config", "clash"), getFilesPath: () => filesPath
    });
    const client = createTunClient({ tun: native.tun, getTapInfo: () => ({}) });
    const methods = homePage().methods;
    Object.assign(fixtureState.model, { mixedPort: 7890, createTunRuntime: () => client,
        spawnTun2socks: methods.spawnTun2socks, killSpawned: methods.killSpawned });
    const oldSelection = fixtureState.page.switchProfile(0);
    await waiting.promise;
    await native.tun.cancel("0-0");
    assert.equal(commands.some(command => command[0] === "taskkill"), false, "unrelated cancellation must not stop this process");
    await assert.rejects(native.tun.cancel("invalid"), /Invalid TAP request identity/);
    await assert.rejects(handler({ sender: {}, senderFrame: {} }, "tun", "cancel", {}), /main window/);
    const lastSelection = fixtureState.page.switchProfile(1);
    ready = true;
    resume.resolve();
    await Promise.all([oldSelection, lastSelection]);
    assert.equal(commands.some(command => command[0] === "route" && command[1] === "add"), false);
    assert.deepEqual(commands.filter(command => command[0] === "taskkill"), [["taskkill", "/F", "/PID", "101"]]);
    assert.equal(fixtureState.model.tun2socks, null);
    assert.equal(fixtureState.store.state.app.profiles.index, 1);
    await fixtureState.page.switchProfile(0);
    assert.equal(fixtureState.model.tun2socks.pid, 102);
    assert.equal(commands.filter(command => command[0] === "route" && command[1] === "add").length, 0);
    assert.deepEqual(fixtureState.dialogs, []);

    await t.test("Enable burst switching between two :53 profiles replaces TAP once and leaves only the final process", async () => {
        fs.writeFileSync(path.join(directory, "other-tap.yaml"), "interface-name: Ethernet\ndns: { enable: true, listen: '0.0.0.0:53', nameserver: [9.9.9.9] }\nrules: ['MATCH,REJECT']\n");
        fixtureState.store.commit("APPEND_PROFILE", { profile: { time: "other-tap.yaml" } });
        const entered = deferred(), applied = deferred();
        let writes = 0;
        fixtureState.model.clashApi.putConfig = async ({ payload }) => {
            fixtureState.payloads.push(yaml.parse(payload));
            if (++writes === 1) { entered.resolve(); await applied.promise; }
            return { status: 204 };
        };
        const requests = [fixtureState.page.switchProfile(2)];
        await entered.promise;
        for (let index = 0; index < 20; index++) requests.push(fixtureState.page.switchProfile(index % 2 ? 2 : 0));
        requests.push(fixtureState.page.switchProfile(2));
        await new Promise(setImmediate);
        assert.equal(writes, 1, "an in-flight controller write must finish first");
        assert.equal(fixtureState.model.tun2socks.pid, 102, "the previously accepted TAP remains active while preparing the next profile");
        applied.resolve();
        await Promise.all(requests);
        assert.equal(writes, 2, "only the in-flight and final configurations reach the core");
        assert.equal(fixtureState.store.state.app.profiles.index, 2);
        assert.deepEqual(fixtureState.model.currentProfilePayload.dns.nameserver, ["9.9.9.9"]);
        assert.equal(fixtureState.model.tun2socks.pid, 103);
        const spawned = commands.filter(command => command[0] === "spawn").map(command => command[1]);
        const killed = new Set(commands.filter(command => command[0] === "taskkill").map(command => Number(command[3])));
        assert.deepEqual(spawned, [101, 102, 103]);
        assert.deepEqual(spawned.filter(pid => !killed.has(pid)), [103], "only the latest TAP process survives");
        assert.deepEqual(fixtureState.page.loadingProfileIndex, []);
        assert.deepEqual(fixtureState.dialogs, []);
    });
});

test("a TAP profile accepted after a newer selection cannot start TAP or overwrite the final profile", async t => {
    const entered = deferred(), applied = deferred();
    const fixtureState = fixture(t);
    fixtureState.model.clashApi.putConfig = async ({ payload }) => {
        fixtureState.payloads.push(yaml.parse(payload));
        if (fixtureState.payloads.length === 1) { entered.resolve(); await applied.promise; }
        return { status: 204 };
    };
    const oldSelection = fixtureState.page.switchProfile(0);
    await entered.promise;
    const finalSelection = fixtureState.page.switchProfile(1);
    await new Promise(setImmediate);
    assert.equal(fixtureState.payloads.length, 1, "the next controller write waits for the in-flight write");
    applied.resolve();
    await Promise.all([oldSelection, finalSelection]);
    assert.equal(fixtureState.payloads.length, 2);
    assert.equal(fixtureState.events.includes("startTap"), false);
    assert.equal(fixtureState.store.state.app.profiles.index, 1);
    assert.equal(fixtureState.model.currentProfilePayload.dns.enable, false);
    assert.equal(fixtureState.model.tun2socks, null);
    assert.deepEqual(fixtureState.dialogs, []);
});

test("a delayed rejection from an old profile cannot clear a later successful selection", async t => {
    const entered = deferred(), rejected = deferred();
    const fixtureState = fixture(t);
    fixtureState.model.clashApi.putConfig = async ({ payload }) => {
        fixtureState.payloads.push(yaml.parse(payload));
        if (fixtureState.payloads.length === 1) { entered.resolve(); await rejected.promise; return { status: 400, data: { message: "old profile rejected" } }; }
        return { status: 204 };
    };
    const oldSelection = fixtureState.page.switchProfile(0);
    await entered.promise;
    const finalSelection = fixtureState.page.switchProfile(1);
    rejected.resolve();
    await Promise.all([oldSelection, finalSelection]);
    assert.equal(fixtureState.store.state.app.profiles.index, 1);
    assert.equal(fixtureState.model.currentProfilePayload.dns.enable, false);
    assert.deepEqual(fixtureState.dialogs, []);
    assert.deepEqual(fixtureState.page.loadingProfileIndex, []);
});
