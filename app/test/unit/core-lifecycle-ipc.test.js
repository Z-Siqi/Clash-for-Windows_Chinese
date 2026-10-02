"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { registerCoreLifecycleIpc } = require("../../main/dist/electron/features/clash-core/register-core-lifecycle-ipc");
const { createCoreLifecycleClient } = require("../../main/dist/electron/core/native/core-lifecycle-client");

function harness(t) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-core-ipc-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const clashPath = path.join(home, ".config", "clash");
    fs.mkdirSync(path.join(clashPath, "logs"), { recursive: true });
    const calls = [];
    const mainFrame = {};
    const webContents = { mainFrame, isDestroyed: () => false, send: (...args) => calls.push(["send", ...args]) };
    let handler;
    registerCoreLifecycleIpc({
        ipcMain: { handle(channel, callback) { assert.equal(channel, "core-lifecycle"); handler = callback; } },
        app: { getPath: name => name === "home" ? home : path.join(home, "app.exe"), once() {} },
        getMainWindow: () => ({ webContents }), fs, path,
        filesPath: path.join(home, "packaged"), platform: "win32", arch: "x64", clashApi: {},
        runtime: {
            async start(options) { calls.push(["start", options]); return { processHandle: { pid: 123, kill() {} } }; },
            async stop(options) { calls.push(["stop", options]); },
            async getStatus() { return { connected: false }; }, killProcess() {}
        }
    });
    return { home, clashPath, handler, calls, event: { sender: webContents, senderFrame: mainFrame } };
}

test("core lifecycle owns packaged filenames and process handles instead of trusting renderer paths or PIDs", async t => {
    const { handler, event, clashPath, calls, home } = harness(t);
    const result = await handler(event, "start", {
        clashPath, coreType: "mihomo", logLevel: "info", isLocalMode: true,
        binaryPath: "untrusted.exe", devMode: true
    });
    assert.deepEqual(result.processHandle, { pid: 123 });
    assert.equal(calls[0][1].binaryPath, path.join(home, "packaged", "win", "x64", "mihomo-windows-amd64.exe"));
    assert.equal(calls[0][1].devMode, false);
    await handler(event, "stop", { processHandle: { pid: 999 } });
    assert.equal(calls[1][1].processHandle.pid, 123);
});

test("core lifecycle rejects foreign senders, subframes, arbitrary binaries and data directories", async t => {
    const { handler, event, clashPath, calls, home } = harness(t);
    assert.throws(() => handler({ ...event, sender: {} }, "start"), /main frame/);
    assert.throws(() => handler({ ...event, senderFrame: {} }, "start"), /main frame/);
    assert.throws(() => handler(event, "exec"), /Unsupported/);
    await assert.rejects(handler(event, "start", { clashPath, coreType: "other", logLevel: "info" }), /selection/);
    await assert.rejects(handler(event, "start", { clashPath: home, coreType: "clash", logLevel: "info" }), /outside/);
    await assert.rejects(handler(event, "start", { clashPath, coreType: "clash", logLevel: "info; whoami" }), /log level/);
    assert.deepEqual(calls, []);
});

test("core lifecycle client sends only declarative settings and adapts readiness and service fallback", async () => {
    const calls = [];
    let listener;
    const client = createCoreLifecycleClient({ ipcRenderer: {
        on(channel, callback) { assert.equal(channel, "core-lifecycle-event"); listener = callback; },
        async invoke(...args) { calls.push(args); return { fallback: true }; }
    } });
    let ready = false, fallback = false, log;
    await client.start({
        clashPath: "home", coreType: "clash", logLevel: "info", isLocalMode: true, lightweightMode: false,
        binaryPath: "arbitrary.exe", onCoreReady: () => { ready = true; },
        onLogFile: value => { log = value; }, onServiceFallback: () => { fallback = true; }
    });
    assert.equal(Object.hasOwn(calls[0][2], "binaryPath"), false);
    assert.equal(fallback, true);
    listener({}, { type: "ready" });
    listener({}, { type: "log", value: "core.log" });
    assert.equal(ready, true);
    assert.equal(log, "core.log");
});
