"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { registerCoreStreamIpc } = require("../../main/dist/electron/features/clash-core/register-core-stream-ipc");
const { createCoreStreamClient } = require("../../main/dist/electron/core/native/core-stream-client");

test("stream subscriptions survive controller startup and reconnect without route changes", async () => {
    let ready = false;
    let listener;
    let failStart = true;
    const timers = new Map();
    const calls = [];
    const open = createCoreStreamClient({
        isReady: () => ready,
        schedule(callback) { const handle = {}; timers.set(handle, callback); return handle; },
        cancel(handle) { timers.delete(handle); },
        ipcRenderer: {
            on(_channel, callback) { listener = callback; },
            async invoke(...args) {
                calls.push(args);
                if (args[1] === "start" && failStart) { failStart = false; throw Error("not ready"); }
            }
        }
    });
    const tick = async () => {
        const [handle, callback] = timers.entries().next().value;
        timers.delete(handle);
        callback();
        await Promise.resolve();
    };
    let payload;
    const stream = open("connections").on("message", value => { payload = value; });
    assert.equal(calls.length, 0);
    ready = true;
    await tick();
    await tick();
    const id = calls.at(-1)[2].id;
    listener({}, { id, type: "open" });
    listener({}, { id, type: "message", value: "first snapshot" });
    assert.equal(payload, "first snapshot");
    assert.equal(stream.readyState, 1);
    listener({}, { id, type: "close" });
    assert.equal(timers.size, 1);
    await tick();
    const replacementId = calls.at(-1)[2].id;
    assert.notEqual(replacementId, id);
    listener({}, { id, type: "message", value: "stale snapshot" });
    assert.equal(payload, "first snapshot");
    listener({}, { id: replacementId, type: "close" });
    stream.terminate();
    assert.equal(timers.size, 0);
    assert.equal(stream.readyState, 3);
});

function harness() {
    let handler;
    const sockets = [];
    const messages = [];
    class FakeSocket extends EventEmitter {
        constructor(url) { super(); this.url = url; sockets.push(this); }
        terminate() { this.terminated = true; this.emit("close"); }
    }
    const webContents = Object.assign(new EventEmitter(), {
        mainFrame: {}, isDestroyed: () => false, send: (...args) => messages.push(args)
    });
    const event = { sender: webContents, senderFrame: webContents.mainFrame };
    registerCoreStreamIpc({
        ipcMain: { handle(channel, callback) { assert.equal(channel, "clash-stream"); handler = callback; } },
        getMainWindow: () => ({ webContents }), WebSocket: FakeSocket,
        getConnectionInfo: () => ({ controllerPort: 9090, secret: "" })
    });
    return { handler, event, sockets, messages, webContents };
}

test("controller streams accept only named loopback subscriptions and dashboard main-frame callers", () => {
    const { handler, event, sockets } = harness();
    assert.throws(() => handler({ ...event, senderFrame: {} }, "start", { id: 1, endpoint: "traffic" }), /main frame/);
    assert.throws(() => handler(event, "start", { id: 1, endpoint: "https://remote.test" }), /Unsupported/);
    assert.throws(() => handler(event, "start", { id: 1, endpoint: "logs", query: ["token=override"] }), /options/);
    assert.equal(sockets.length, 0);
    handler(event, "start", { id: 1, endpoint: "logs", query: ["level=info", "format=structured"] });
    assert.equal(sockets[0].url, "ws://127.0.0.1:9090/logs?token=&level=info&format=structured");
});

test("controller streams relay plain data, sanitize errors and close when the renderer goes away", () => {
    const { handler, event, sockets, messages, webContents } = harness();
    handler(event, "start", { id: 1, endpoint: "traffic" });
    sockets[0].emit("message", Buffer.from('{"up":1,"down":2}'));
    assert.deepEqual(messages.at(-1), ["clash-stream-event", { id: 1, type: "message", value: '{"up":1,"down":2}' }]);
    sockets[0].emit("error", new Error("sensitive transport diagnostic"));
    assert.equal(messages.at(-1)[1].value, "Controller stream unavailable");
    webContents.emit("render-process-gone");
    assert.equal(sockets[0].terminated, true);
});

test("stream client preserves message/terminate behavior without exposing a native socket", async () => {
    let listener;
    const calls = [];
    const open = createCoreStreamClient({ isReady: () => true, ipcRenderer: {
        on(channel, callback) { assert.equal(channel, "clash-stream-event"); listener = callback; },
        async invoke(...args) { calls.push(args); }
    } });
    let payload;
    const stream = open("connections").on("message", value => { payload = value; });
    const id = calls[0][2].id;
    listener({}, { id, type: "message", value: "{}" });
    assert.equal(payload, "{}");
    stream.terminate();
    assert.equal(calls[1][1], "stop");
    listener({}, { id, type: "message", value: "ignored" });
    assert.equal(payload, "{}");
});
