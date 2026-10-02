"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { EventEmitter } = require("node:events");
const yaml = require("../../main/node_modules/yaml");
const { registerProfileDownloadIpc } = require("../../main/dist/electron/entry/main/register-profile-download-ipc");
const { createProfileDownloadClient } = require("../../main/dist/electron/core/native/profile-download-client");
const { createProfileWorkerRuntime } = require("../../main/dist/electron/features/profiles/profile-worker-runtime");

test("profile download host authenticates frames and loads only saved parser policy and file roots", async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-profile-ipc-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const home = path.join(root, ".config", "clash");
    const folder = path.join(home, "profiles");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(home, "config.yaml"), "mixed-port: 12345");
    fs.writeFileSync(path.join(home, "cfw-settings.yaml"), yaml.stringify({ profileParsersText: "saved policy" }));
    fs.writeFileSync(path.join(folder, "list.yml"), "files: []\nindex: -1");
    const mainFrame = {};
    const webContents = { mainFrame };
    const handlers = {};
    let message; let kills = 0;
    const worker = Object.assign(new EventEmitter(), {
        postMessage(value) { message = value; queueMicrotask(() => worker.emit("message", { type: "result", ok: true, value: { result: { success: true }, mutations: [] } })); },
        kill() { kills++; }
    });
    registerProfileDownloadIpc({
        ipcMain: { handle: (channel, callback) => { handlers[channel] = callback; }, on: (channel, callback) => { handlers[channel] = callback; } },
        app: { getPath: name => name === "home" || name === "temp" ? root : path.join(root, "app.exe"), once() {} },
        getMainWindow: () => ({ webContents }), fs, path, yaml, workerPath: "/fixed/profile-worker.js",
        forkWorker(file, args, options) { assert.equal(file, "/fixed/profile-worker.js"); assert.deepEqual(args, []); assert.equal(options.stdio, "ignore"); return worker; }
    });
    const event = { sender: webContents, senderFrame: mainFrame };
    const request = { id: 1, home, url: "https://example.test/profile", headersString: "" };
    assert.throws(() => handlers["profile-download"]({ ...event, senderFrame: {} }, request), /sender/);
    assert.throws(() => handlers["profile-download"](event, { ...request, home: root }), /home/);
    assert.throws(() => handlers["profile-download"](event, { ...request, url: "file:///arbitrary" }), /request/);
    await handlers["profile-download"](event, { ...request, settings: { profileParsersText: "renderer code" }, profilesPath: root });
    assert.equal(message.app.settings.profileParsersText, "saved policy");
    assert.equal(message.app.profilesPath, folder);
    assert.equal(kills, 1);
    fs.writeFileSync(path.join(folder, "list.yml"), yaml.stringify({ files: [{ time: "../outside.yml" }], index: 0 }));
    assert.throws(() => handlers["profile-download"](event, request), /filename/);
});

test("download results target current profile identity when renderer indices change", async () => {
    const commits = [];
    const store = { state: { app: { clashPath: "home", profiles: { files: [{ time: "two.yml", url: "other" }, { time: "one.yml", url: "target" }] } } },
        commit(type, payload) { commits.push({ type, payload }); }
    };
    const client = createProfileDownloadClient({ store, getLanguage: () => 0, ipcRenderer: {
        async invoke() { return { result: { success: true, targetIndex: 0 }, mutations: [{ type: "CHANGE_PROFILE", payload: { index: 0, profile: { time: "one.yml", url: "target" } } }] }; }
    } });
    const result = await client.downloadProfile({ url: "target" });
    assert.equal(commits[0].payload.index, 1);
    assert.equal(result.targetIndex, 1);
});

test("profile worker uses parser policy from the host snapshot and produces portable update results", async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-profile-worker-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    let handler; const messages = []; let parseCalls = 0;
    createProfileWorkerRuntime({
        parentPort: { on(_channel, callback) { handler = callback; }, postMessage: value => messages.push(value) },
        createLanguage: () => ({}),
        parserDependencies: {
            fs, path, yaml, axios: { get: async () => ({ status: 200, headers: {}, data: "proxies: []" }) },
            Console: class {}, requireFromString: code => { assert.match(code, /saved code/); return { parse: async content => { parseCalls++; return content; } }; },
            parseContentDisposition: () => ({}), createProfileTime: () => "fixed.yml"
        }
    });
    await handler({ data: {
        type: "download", url: "https://example.test/profile", headersString: "", logPath: path.join(root, "parser.log"),
        app: { clashPath: root, profilesPath: root, profiles: { files: [] }, confData: {}, settings: { profileParsersText: yaml.stringify({ parsers: [{ url: "https://example.test/profile", code: "saved code" }] }) } }
    } });
    assert.equal(parseCalls, 1);
    assert.equal(messages[0].value.result.success, true);
    assert.equal(messages[0].value.mutations[0].type, "APPEND_PROFILE");
    assert.equal(fs.readFileSync(path.join(root, "fixed.yml"), "utf8"), "proxies: []");
});

test("bulk downloads queue behind four active workers and queued cancellation does not launch a worker", async () => {
    const pending = [];
    let active = 0; let peak = 0; let calls = 0;
    const client = createProfileDownloadClient({
        store: { state: { app: { clashPath: "home", profiles: { files: [] } } } }, getLanguage: () => 0,
        ipcRenderer: { invoke() {
            calls++; active++; peak = Math.max(peak, active);
            return new Promise(resolve => pending.push(() => { active--; resolve({ result: { success: false }, mutations: [] }); }));
        }, send() { throw new Error("Queued cancellation must not send a worker request"); } }
    });
    const downloads = Array.from({ length: 4 }, () => client.downloadProfile({ url: "https://example.test/profile" }));
    downloads.push(client.downloadProfile({ url: "https://example.test/cancelled", cancelToken: { promise: Promise.resolve() } }));
    downloads.push(client.downloadProfile({ url: "https://example.test/queued" }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 4);
    pending.splice(0).forEach(finish => finish());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 5);
    pending.splice(0).forEach(finish => finish());
    assert.equal((await Promise.all(downloads))[4].success, false);
    assert.equal(peak, 4);
});

test("failed atomic profile replacement retains old content and publishes no metadata", async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-profile-atomic-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, "existing.yml"), "old profile");
    let handler; let result;
    createProfileWorkerRuntime({
        parentPort: { on(_channel, callback) { handler = callback; }, postMessage: message => { result = message; } },
        createLanguage: () => ({ downloadProfile: () => "Download", failedWithError: () => "Failed" }),
        parserDependencies: {
            fs: { ...fs, renameSync() { throw new Error("Simulated rename failure"); } }, path, yaml,
            axios: { get: async () => ({ status: 200, data: "new profile", headers: {} }) }, Console: class {},
            parseContentDisposition: () => ({})
        }
    });
    await handler({ data: {
        type: "download", url: "https://example.test/profile", headersString: "", logPath: path.join(root, "parser.log"),
        app: { clashPath: root, profilesPath: root, profiles: { files: [{ time: "existing.yml", url: "https://example.test/profile" }] }, confData: {}, settings: {} }
    } });
    assert.equal(result.value.result.success, false);
    assert.deepEqual(result.value.mutations, []);
    assert.equal(fs.readFileSync(path.join(root, "existing.yml"), "utf8"), "old profile");
    assert.equal(fs.readdirSync(root).some(name => name.endsWith(".tmp")), false);
});
