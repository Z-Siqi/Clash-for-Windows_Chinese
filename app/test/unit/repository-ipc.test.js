"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const yaml = require("../../main/node_modules/yaml");
const { registerRepositoryIpc } = require("../../main/dist/electron/entry/main/register-repository-ipc");
const { createRepositoryClients } = require("../../main/dist/electron/core/native/repository-client");
const { createCoreConfigClient } = require("../../main/dist/electron/core/native/core-config-client");

function harness(t, injectedFs = fs, coreConfig = false) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-repo-ipc-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const home = path.join(root, ".config", "clash");
    fs.mkdirSync(home, { recursive: true });
    const mainFrame = {};
    const rendererListeners = new Map();
    const webContents = Object.assign(new EventEmitter(), {
        mainFrame, isDestroyed: () => false,
        send(channel, value) { rendererListeners.get(channel)?.({}, value); }
    });
    let handler;
    let coreHandler;
    let fileHandler;
    const assets = path.join(root, "assets");
    if (coreConfig) {
        fs.mkdirSync(path.join(assets, "default"), { recursive: true });
        fs.writeFileSync(path.join(assets, "default", "Country.mmdb"), "fixture");
    }
    registerRepositoryIpc({
        ipcMain: {
            on(channel, callback) { assert.equal(channel, "cfw-repository"); handler = callback; },
            handle(channel, callback) {
                if (channel === "profile-files") fileHandler = callback;
                else { assert.equal(channel, "core-config"); coreHandler = callback; }
            }
        },
        app: { isPackaged: true, getPath: name => name === "home" ? root : path.join(root, "app.exe") },
        getMainWindow: () => ({ webContents }), fs: injectedFs, path, yaml,
        filesPath: coreConfig ? assets : undefined, platform: "linux", arch: "x64",
        getPort: async () => 23456, uuid: () => ""
    });
    const event = { sender: webContents, senderFrame: mainFrame };
    const clients = createRepositoryClients({ getHome: () => home, ipcRenderer: {
        on: (channel, callback) => rendererListeners.set(channel, callback),
        removeListener: channel => rendererListeners.delete(channel),
        invoke(channel, operation, request) { assert.equal(channel, "profile-files"); return fileHandler(event, operation, request); },
        sendSync(channel, operation, request) {
            assert.equal(channel, "cfw-repository");
            handler(event, operation, request);
            return event.returnValue;
        }
    } });
    return { root, home, handler, coreHandler, fileHandler, event, clients };
}

test("profile file IPC reads only saved profile identities and cleans only old inactive generated profiles", async t => {
    const { clients, home, fileHandler, event } = harness(t);
    const folder = path.join(home, "profiles");
    clients.profiles.initialize(folder);
    clients.profiles.save(folder, { files: [{ time: "1.yml" }], index: 0 });
    for (const name of ["1.yml", "2.yml", "notes.yml"]) fs.writeFileSync(path.join(folder, name), "rules: []");
    const old = new Date(Date.now() - 40 * 86400000);
    for (const name of ["1.yml", "2.yml", "notes.yml"]) fs.utimesSync(path.join(folder, name), old, old);
    assert.equal(await clients.profiles.readProfile(folder, "1.yml"), "rules: []");
    await clients.profiles.writeProfile(folder, "1.yml", "rules: [MATCH,DIRECT]");
    assert.equal(await clients.profiles.readProfile(folder, "1.yml"), "rules: [MATCH,DIRECT]");
    await assert.rejects(() => clients.profiles.writeProfile(folder, "list.yml", "arbitrary list"), /operation failed/);
    await assert.rejects(() => clients.profiles.readProfile(folder, "../outside.yml"), /operation failed/);
    assert.equal((await fileHandler({ ...event, senderFrame: {} }, "read-profile", { home, profilesPath: folder, time: "1.yml" })).ok, false);
    assert.ok((await clients.profiles.modificationTimes(folder))["1.yml"] > old.getTime());
    assert.equal(await clients.profiles.cleanupOrphans(folder), 1);
    assert.equal(fs.existsSync(path.join(folder, "1.yml")), true);
    assert.equal(fs.existsSync(path.join(folder, "notes.yml")), true);
    assert.equal(fs.existsSync(path.join(folder, "2.yml")), false);
});

test("profile copies, Diff companions and watchers remain inside the configured folder", async t => {
    const { clients, home } = harness(t);
    const folder = path.join(home, "profiles");
    clients.profiles.initialize(folder);
    clients.profiles.save(folder, { files: [{ time: "1.yml" }], index: 0 });
    fs.writeFileSync(path.join(folder, "1.yml"), "rules: []");
    const copied = await clients.profiles.createLocal(folder, "1.yml");
    assert.equal(fs.readFileSync(path.join(folder, copied), "utf8"), "rules: []");
    await assert.rejects(() => clients.profiles.createLocal(folder, "../config.yaml"), /operation failed/);
    assert.deepEqual(await clients.profiles.readDiff(folder, "1.yml"), { initialized: false });
    assert.deepEqual(await clients.profiles.initializeDiff(folder, "1.yml"), { initialized: true, base: "rules: []", change: "rules: []" });
    await clients.profiles.writeDiff(folder, "1.yml", "rules: [MATCH,DIRECT]");
    assert.equal((await clients.profiles.readDiff(folder, "1.yml")).change, "rules: [MATCH,DIRECT]");
    await clients.profiles.deleteDiff(folder, "1.yml");
    assert.equal(fs.existsSync(path.join(folder, "1.yml")), true);
    assert.equal(fs.existsSync(path.join(folder, "1.base.yml")), false);
    let notified;
    const changed = new Promise(resolve => { notified = resolve; });
    const watcher = clients.profiles.watch(folder, notified);
    t.after(() => watcher.close());
    await new Promise(resolve => setImmediate(resolve));
    await clients.profiles.writeProfile(folder, "1.yml", "rules: [MATCH,REJECT]");
    const timeout = setTimeout(() => notified("timed-out"), 2000);
    assert.equal(await changed, "1.yml");
    clearTimeout(timeout);
    watcher.close();
});

test("repository IPC persists settings and profile lists without exposing filesystem operations", t => {
    const { clients, home } = harness(t);
    clients.settings.save(home, { proxyCore: "mihomo", language: 1, randomMixedPort: false });
    let language;
    assert.equal(clients.settings.load(home, value => { language = value; }).proxyCore, "mihomo");
    assert.equal(language, 1);
    const folder = path.join(home, "profiles");
    clients.profiles.initialize(folder);
    assert.deepEqual(clients.profiles.load(folder), { files: [], index: -1 });
    const profiles = { files: [{ name: "example", time: "1.yml" }], index: 0 };
    clients.profiles.save(folder, profiles);
    assert.deepEqual(clients.profiles.load(folder), profiles);
});

test("repository IPC rejects untrusted frames, arbitrary operations and unconfigured paths", t => {
    const { handler, event, home, root } = harness(t);
    for (const [requestEvent, operation, request] of [
        [{ ...event, sender: {} }, "settings-load", { home }],
        [{ ...event, senderFrame: {} }, "settings-load", { home }],
        [event, "readFile", { home }],
        [event, "settings-save", { home: root, settings: {} }],
        [event, "profiles-save", { home, profilesPath: root, profiles: { files: [], index: -1 } }]
    ]) {
        handler(requestEvent, operation, request);
        assert.equal(requestEvent.returnValue.ok, false);
    }
    assert.deepEqual(fs.readdirSync(home), []);
});

test("repository client reports failed atomic writes without exposing sensitive errors or changing disk state", t => {
    const failingFs = { ...fs, renameSync() { throw new Error("sensitive filesystem diagnostic"); } };
    const { home, clients } = harness(t, failingFs);
    fs.writeFileSync(path.join(home, "cfw-settings.yaml"), "proxyCore: clash\n");
    assert.throws(() => clients.settings.save(home, { proxyCore: "mihomo" }), error => {
        assert.equal(error.message, "Application repository operation failed");
        return true;
    });
    assert.equal(yaml.parse(fs.readFileSync(path.join(home, "cfw-settings.yaml"), "utf8")).proxyCore, "clash");
    assert.deepEqual(fs.readdirSync(home), ["cfw-settings.yaml"]);
});

test("repository IPC rejects a default profile directory redirected outside the application home", t => {
    const { home, root, clients } = harness(t);
    const outside = path.join(root, "outside");
    fs.mkdirSync(outside);
    try { fs.symlinkSync(outside, path.join(home, "profiles"), process.platform === "win32" ? "junction" : "dir"); }
    catch (error) { if (["EPERM", "EACCES"].includes(error.code)) { t.skip("Directory symlinks are unavailable"); return; } throw error; }
    assert.throws(() => clients.profiles.initialize(path.join(home, "profiles")), /repository operation failed/);
    assert.deepEqual(fs.readdirSync(outside), []);
});

test("core configuration IPC initializes fixed assets and preserves a manual mixed port while randomizing its controller", async t => {
    const { home, root, coreHandler, event, clients } = harness(t, fs, true);
    const core = createCoreConfigClient({ shouldReplaceWintun: async () => false, ipcRenderer: {
        invoke(channel, operation, request) { assert.equal(channel, "core-config"); return coreHandler(event, operation, request); }
    } });
    await core.initialize(home, "untrusted assets directory");
    const initial = await core.load(home);
    assert.equal(initial["allow-lan"], false);
    assert.equal(initial["external-controller"], "127.0.0.1:9090");
    fs.writeFileSync(path.join(home, "config.yaml"), "mixed-port: 7894\nexternal-controller: 127.0.0.1:9090\n");
    clients.settings.save(home, { randomMixedPort: false, randomControllerPort: true });
    let changed;
    await core.randomizePorts({ clashPath: home, lightweightMode: false, onChange: value => { changed = value; } });
    assert.equal(changed["mixed-port"], 7894);
    assert.equal(changed["external-controller"], "127.0.0.1:23456");
    assert.equal((await core.load(home))["mixed-port"], 7894);
    assert.equal((await coreHandler({ ...event, senderFrame: {} }, "load", { home })).ok, false);
    assert.equal((await coreHandler(event, "initialize", { home: path.join(root, "arbitrary") })).ok, false);
    assert.equal(fs.existsSync(path.join(root, "arbitrary")), false);
});

test("core configuration edits restrict owned keys and reset preserves unrelated files", async t => {
    const { home, coreHandler, event } = harness(t, fs, true);
    const core = createCoreConfigClient({ shouldReplaceWintun: async () => false, ipcRenderer: {
        invoke: (_channel, operation, request) => coreHandler(event, operation, request)
    } });
    await core.initialize(home);
    await core.update(home, "mixed-port", "12345");
    assert.equal((await core.load(home))["mixed-port"], 12345);
    await assert.rejects(() => core.update(home, "mixed-port", "12345 & injected"), /operation failed/);
    await assert.rejects(() => core.update(home, "external-controller", "0.0.0.0:12345"), /operation failed/);
    await assert.rejects(() => core.update(home, "secret", ""), /operation failed/);
    assert.equal((await core.load(home))["external-controller"], "127.0.0.1:9090");
    assert.ok((await core.metadata(home)).geoipModifiedAt > 0);
    fs.writeFileSync(path.join(home, "unrelated.txt"), "keep");
    await core.reset(home);
    assert.equal(fs.existsSync(path.join(home, "config.yaml")), false);
    assert.equal(fs.existsSync(path.join(home, "Country.mmdb")), false);
    assert.equal(fs.readFileSync(path.join(home, "unrelated.txt"), "utf8"), "keep");
});
