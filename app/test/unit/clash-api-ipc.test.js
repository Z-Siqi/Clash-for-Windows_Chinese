"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { registerClashApiIpc } = require("../../main/dist/electron/entry/main/register-clash-api-ipc");
const { createClashApiClient } = require("../../main/dist/electron/core/native/clash-api-client");

function harness(api) {
    let handler, cancel;
    const mainFrame = {};
    const webContents = { mainFrame };
    const event = { sender: webContents, senderFrame: mainFrame };
    registerClashApiIpc({
        ipcMain: {
            handle(channel, callback) { assert.equal(channel, "clash-api"); handler = callback; },
            on(channel, callback) { assert.equal(channel, "clash-api-cancel"); cancel = callback; }
        }, getMainWindow: () => ({ webContents }), clashApi: api
    });
    return { handler, cancel, event };
}

test("semantic controller IPC cannot override transport, endpoints or serialize Axios credentials", async () => {
    let received;
    const { handler, event } = harness({ async getConfig(options) {
        received = options;
        return { status: 200, data: { mode: "rule" }, config: { privateTransportState: true }, request: {} };
    } });
    const result = await handler(event, "getConfig", {
        id: 1, args: [], options: { timeout: 1000, baseURL: "https://remote.test", headers: { unrelated: "header" }, acceptAllStatus: true }
    });
    assert.deepEqual(result, { ok: true, value: { status: 200, data: { mode: "rule" } } });
    assert.equal(received.baseURL, undefined);
    assert.equal(received.headers, undefined);
    assert.equal(received.timeout, 1000);
    await assert.rejects(handler({ ...event, senderFrame: {} }, "getConfig", { id: 2, args: [] }), /main frame/);
    await assert.rejects(handler(event, "get", { id: 2, args: ["https://remote.test"] }), /Unsupported/);
    await assert.rejects(handler(event, "getProvider", { id: 2, args: ["../configs", "name"] }), /provider type/);
});

test("UI reload retires old replies and serializes an accepted PUT before the new page's configuration", async () => {
    let handler, resolveOld;
    const calls = [], applied = [], sender = Object.assign(new EventEmitter(), { mainFrame: {} });
    const event = { sender, senderFrame: sender.mainFrame };
    registerClashApiIpc({ ipcMain: { on() {}, handle(_channel, action) { handler = action; } },
        getMainWindow: () => ({ webContents: sender }), onConfigApplied: config => applied.push(config.payload),
        clashApi: { async putConfig(config, options) {
            assert.ok(options.timeout > 0, "an obsolete PUT cannot block the next page indefinitely");
            calls.push(config.payload);
            if (config.payload === "old") await new Promise(resolve => { resolveOld = resolve; });
            return { status: 204 };
        } } });
    const old = handler(event, "putConfig", { id: 1, args: [{ payload: "old" }], options: { timeout: 0 } });
    await Promise.resolve();
    await Promise.resolve();
    const queued = handler(event, "putConfig", { id: 2, args: [{ payload: "old-queued" }] });
    sender.emit("did-start-loading");
    const fresh = handler(event, "putConfig", { id: 1, args: [{ payload: "new" }] });
    resolveOld();
    assert.equal((await old).error.code, "ERR_CANCELED");
    assert.equal((await queued).error.code, "ERR_CANCELED");
    assert.equal((await fresh).ok, true);
    assert.deepEqual(calls, ["old", "new"]);
    assert.deepEqual(applied, ["new"]);
});

test("semantic controller client carries cancellation across IPC and balances request state", async () => {
    const changes = [];
    const { handler, cancel, event } = harness({ getConfig({ signal }) {
        return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject({ code: "ERR_CANCELED", config: {} }), { once: true }));
    } });
    const client = createClashApiClient({
        isReady: () => true, onRequestChange: value => changes.push(value),
        ipcRenderer: { invoke: (channel, operation, request) => handler(event, operation, request), send: (channel, id) => cancel(event, id) }
    });
    const abort = new AbortController();
    const pending = client.getConfig({ signal: abort.signal });
    abort.abort();
    await assert.rejects(pending, error => error.code === "ERR_CANCELED" && error.__CANCEL__ === true);
    assert.deepEqual(changes, [1, -1]);
});

test("controller failures return bounded public error fields instead of request configuration", async () => {
    const { handler, event } = harness({ async getVersion() { throw { code: "ECONNREFUSED", config: { private: true }, message: "sensitive request diagnostic" }; } });
    const result = await handler(event, "getVersion", { id: 1, args: [] });
    assert.equal(result.error.message, "Controller request failed");
    assert.equal(result.error.code, "ECONNREFUSED");
    assert.equal(Object.hasOwn(result.error, "config"), false);
});
