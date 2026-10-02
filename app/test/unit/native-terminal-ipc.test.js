"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path").win32;
const { registerNativeAdminIpc } = require("../../main/dist/electron/entry/main/register-native-admin-ipc");
const { registerCoreLogIpc } = require("../../main/dist/electron/features/logs/register-core-log-ipc");

test("terminal IPC accepts only fixed terminal choices, validated ports and the packaged loopback helper", async () => {
    let handler;
    const calls = [];
    const mainFrame = {};
    const webContents = { mainFrame };
    registerNativeAdminIpc({
        ipcMain: { handle(_channel, callback) { handler = callback; } },
        app: { isPackaged: true, getPath: name => name === "home" ? "C:\\Users\\tester" : "C:\\app\\app.exe", once() {} },
        getMainWindow: () => ({ webContents }), fs: {}, path, platform: "win32", resourcesPath: "C:\\app\\resources",
        childProcess: { spawn(...args) { calls.push(args); return { on() {}, unref() {} }; } }, sudoPrompt: {}, axios: {},
        shell: { openPath: file => { calls.push(file); return ""; } }
    });
    const event = { sender: webContents, senderFrame: mainFrame };
    const payload = { clashPath: "C:\\Users\\tester\\.config\\clash", filesPath: "C:\\app\\resources\\static\\files", selection: 0, elevated: false, port: 12345 };
    await assert.rejects(() => handler(event, "terminal", "open", { ...payload, selection: "cmd & injected" }), /terminal/);
    await assert.rejects(() => handler(event, "terminal", "open", { ...payload, port: "12345 & injected" }), /terminal/);
    assert.equal(calls.length, 0);
    await handler(event, "terminal", "open", payload);
    assert.equal(calls[0][0], "cmd");
    assert.equal(calls[0][2].env.http_proxy, "http://127.0.0.1:12345");
    assert.equal(calls[0][2].windowsHide, false);
    await handler(event, "terminal", "loopback", { ...payload, executable: "injected.exe" });
    assert.equal(calls[1], "C:\\app\\resources\\static\\files\\win\\common\\EnableLoopback.exe");
});

test("core log IPC reads the host-owned current log without accepting renderer paths", async () => {
    let handler;
    const mainFrame = {};
    const webContents = { mainFrame };
    const reads = [];
    registerCoreLogIpc({
        ipcMain: { handle(_channel, callback) { handler = callback; } }, getMainWindow: () => ({ webContents }),
        getLogFile: () => "/known/logs/current.log", readLastLines: { read: async (...args) => { reads.push(args); return "core logs"; } }
    });
    const event = { sender: webContents, senderFrame: mainFrame };
    await assert.rejects(() => handler({ ...event, senderFrame: {} }, 30), /sender/);
    await assert.rejects(() => handler(event, "/arbitrary/path"), /count/);
    assert.equal(await handler(event, 30, "/ignored/path"), "core logs");
    assert.deepEqual(reads, [["/known/logs/current.log", 30]]);
});
