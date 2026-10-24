"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const yaml = require("../../main/node_modules/yaml");
const { registerUserScriptIpc } = require("../../main/dist/electron/features/scripts/register-user-script-ipc");
const { createScriptWorkerRuntime } = require("../../main/dist/electron/features/scripts/script-worker-runtime");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

test("context scripts report unconfigured/disabled without starting a worker and notify the renderer", async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-action-feedback-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const home = path.join(root, ".config", "clash");
    fs.mkdirSync(home, { recursive: true });
    let handler, forks = 0;
    const webContents = { mainFrame: {} };
    registerUserScriptIpc({ ipcMain: { handle(_name, callback) { handler = callback; } },
        app: { getPath: name => name === "home" || name === "temp" ? root : path.join(root, "app.exe"), once() {} },
        getMainWindow: () => ({ webContents }), fs, path, yaml, workerPath: "fixed",
        forkWorker() { forks++; throw Error("must not start"); }, dialog: {}, Notification: class {}, clashApi: {} });
    const { createUserScriptClient, PROFILE_SCRIPT, PROXY_SCRIPT } = require("../../main/dist/electron/core/native/user-script-client");
    const notices = [], errors = [];
    const client = createUserScriptClient({ getHome: () => home, onUnavailable: status => notices.push(status),
        onError: () => errors.push(true), ipcRenderer: { invoke: (_channel, request) => handler({ sender: webContents, senderFrame: webContents.mainFrame }, request) } });
    await client.run({}, PROFILE_SCRIPT);
    fs.writeFileSync(path.join(home, "cfw-settings.yaml"), yaml.stringify({ scriptsText: "scripts: { profile: { code: saved } }" }));
    await client.run({}, PROXY_SCRIPT);
    fs.writeFileSync(path.join(home, "cfw-settings.yaml"), yaml.stringify({ actionScriptsEnabled: false, scriptsText: "scripts: { proxy: { code: saved } }" }));
    await client.run({}, PROXY_SCRIPT);
    assert.deepEqual(notices, ["unconfigured", "unconfigured", "disabled"]);
    assert.deepEqual(errors, []);
    assert.equal(forks, 0);
});

test("user script IPC reads saved script sources and forks a fixed utility entry instead of running renderer code", async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-script-ipc-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const home = path.join(root, ".config", "clash");
    fs.mkdirSync(home, { recursive: true });
    const saved = "module.exports.run = () => {}";
    fs.writeFileSync(path.join(home, "cfw-settings.yaml"), yaml.stringify({ scriptsText: yaml.stringify({ scripts: { proxy: { code: saved } } }) }));
    let handler;
    const mainFrame = {};
    const webContents = { mainFrame };
    const event = { sender: webContents, senderFrame: mainFrame };
    const messages = [];
    const dialogs = [];
    let language = 0, currentJob;
    const labels = createTranslator(() => language);
    let forks = 0;
    const worker = Object.assign(new EventEmitter(), {
        postMessage(message) {
            messages.push(message);
            if (message.type === "run") {
                currentJob = message.job;
                queueMicrotask(() => worker.emit("message", { type: "effect", job: currentJob, id: 1, method: "dialog", args: [{ message: "user script text" }] }));
            } else if (message.type === "effect-result") {
                queueMicrotask(() => worker.emit("message", { type: "result", job: currentJob, ok: true }));
            }
        },
        kill() {}
    });
    registerUserScriptIpc({
        ipcMain: { handle(channel, callback) { if (channel === "user-script") handler = callback; } },
        app: { getPath: name => name === "home" ? root : name === "temp" ? root : path.join(root, "app.exe"), once() {} },
        getMainWindow: () => ({ webContents }), fs, path, yaml, workerPath: "/fixed/script-worker.js",
        forkWorker(file, args, options) { forks++; assert.equal(file, "/fixed/script-worker.js"); assert.deepEqual(args, []); assert.equal(options.stdio, "ignore"); return worker; },
        dialog: { showMessageBox: async (_window, options) => { dialogs.push(options); return { response: 0 }; } },
        getLanguage: () => labels, Notification: class {}, clashApi: {}
    });
    assert.throws(() => handler({ ...event, senderFrame: {} }, { home, scriptType: "proxy" }), /main frame/);
    assert.throws(() => handler(event, { home: root, scriptType: "proxy" }), /home/);
    assert.throws(() => handler(event, { home, scriptType: "exec" }), /type/);
    await handler(event, { home, scriptType: "proxy", payload: {}, code: "untrusted renderer code" });
    assert.equal(forks, 1);
    assert.equal(yaml.parse(messages[0].scriptsText).scripts.proxy.code, saved);
    assert.equal(Object.hasOwn(messages[0], "code"), false);
    assert.deepEqual(dialogs.at(-1).buttons, ["确定"]);
    language = 1;
    await handler(event, { home, scriptType: "proxy", payload: {} });
    assert.deepEqual(dialogs.at(-1).buttons, ["OK"]);
    assert.equal(dialogs.at(-1).message, "user script text");
});

test("script worker awaits asynchronous scripts and relays only named context operations", async () => {
    let handler;
    const messages = [];
    const parentPort = {
        on(channel, callback) { handler = callback; },
        postMessage(message) {
            messages.push(message);
            if (message.type === "effect") queueMicrotask(() => handler({ data: { type: "effect-result", id: message.id, ok: true, value: "resolved" } }));
        }
    };
    let completed = false;
    createScriptWorkerRuntime({
        parentPort, axios: {}, yaml,
        fs: { createWriteStream: () => ({}) }, Console: class {},
        requireFromString: () => ({ async run(payload, context) {
            assert.equal(await context.resolveHost("example.test", "A"), "resolved");
            completed = true;
        } })
    });
    await handler({ data: { type: "run", job: 1, home: "home", scriptsText: "scripts:\n  proxy:\n    code: fixture", payload: {}, scriptType: "proxy", logPath: "script.log" } });
    assert.equal(completed, true);
    assert.equal(messages[0].method, "resolveHost");
    assert.deepEqual(messages.at(-1), { type: "result", job: 1, ok: true });
});

test("Mixin IPC uses the persisted source and returns the isolated worker result", async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-mixin-ipc-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const home = path.join(root, ".config", "clash");
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, "cfw-settings.yaml"), yaml.stringify({ mixinType: 1, mixinCode: "saved mixin" }));
    let handler;
    const mainFrame = {};
    const webContents = { mainFrame };
    const worker = Object.assign(new EventEmitter(), {
        postMessage(message) {
            assert.equal(message.mixinCode, "saved mixin");
            queueMicrotask(() => worker.emit("message", { type: "result", job: message.job, ok: true, value: { rules: ["MATCH,DIRECT"] } }));
        }, kill() {}
    });
    registerUserScriptIpc({
        ipcMain: { handle(channel, callback) { if (channel === "user-script") handler = callback; } },
        app: { getPath: name => name === "home" || name === "temp" ? root : path.join(root, "app.exe"), once() {} },
        getMainWindow: () => ({ webContents }), fs, path, yaml, workerPath: "/fixed/worker.js",
        forkWorker: () => worker, dialog: {}, Notification: class {}, clashApi: {}
    });
    assert.deepEqual(await handler({ sender: webContents, senderFrame: mainFrame }, {
        home, scriptType: "mixin", mixinCode: "renderer injection", payload: { content: {} }
    }), { rules: ["MATCH,DIRECT"] });
});

test("worker awaits Mixin parse without giving it Electron context objects", async () => {
    let handler;
    const messages = [];
    createScriptWorkerRuntime({
        parentPort: { on(_channel, callback) { handler = callback; }, postMessage: value => messages.push(value) },
        axios: {}, yaml, fs: {}, Console: class {},
        requireFromString: source => {
            assert.equal(source, "saved mixin");
            return { async parse(payload, helpers) {
                assert.deepEqual(Object.keys(helpers).sort(), ["axios", "notify", "yaml"]);
                await Promise.resolve();
                return { ...payload.content, rules: ["MATCH,DIRECT"] };
            } };
        }
    });
    await handler({ data: { type: "run", job: 9, scriptType: "mixin", mixinCode: "saved mixin", payload: { content: { proxies: [] } } } });
    assert.deepEqual(messages, [{ type: "result", job: 9, ok: true, value: { proxies: [], rules: ["MATCH,DIRECT"] } }]);
});

test("Mixin syntax validation compiles without executing submitted code", () => {
    const handlers = {};
    const mainFrame = {};
    const webContents = { mainFrame };
    registerUserScriptIpc({
        ipcMain: { handle(channel, callback) { handlers[channel] = callback; } },
        app: { getPath: () => "/temporary", once() {} }, getMainWindow: () => ({ webContents }),
        fs: {}, path, yaml, forkWorker() { throw new Error("Validation must not fork or execute"); }
    });
    const event = { sender: webContents, senderFrame: mainFrame };
    assert.equal(handlers["mixin-code-validate"](event, "throw new Error('must not execute'); module.exports.parse = () => {}"), true);
    assert.throws(() => handlers["mixin-code-validate"](event, "module.exports.parse = {"), /syntax/);
    assert.throws(() => handlers["mixin-code-validate"]({ ...event, senderFrame: {} }, "module.exports.parse = () => {}"), /sender/);
});
