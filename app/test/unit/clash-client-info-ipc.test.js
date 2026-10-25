"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { registerClashClientInfo } = require("../../main/dist/electron/entry/main/register-clash-client-info");

test("controller registration accepts only a dashboard main-frame request with a valid loopback port", () => {
    let handler;
    const calls = [];
    const mainFrame = {};
    const webContents = { mainFrame };
    const event = { sender: webContents, senderFrame: mainFrame };
    registerClashClientInfo({
        ipcMain: { on(channel, callback) { assert.equal(channel, "clash-core-info"); handler = callback; } },
        registry: { update: value => calls.push(value.port) }, getMainWindow: () => ({ webContents })
    });
    handler({ ...event, sender: {} }, { port: 9090 });
    handler({ ...event, senderFrame: {} }, { port: 9090 });
    for (const port of [0, -1, 65536, 1.5, "9090", "9090@remote.test"]) handler(event, { port });
    handler(event, { port: 9090, secret: {} });
    assert.deepEqual(calls, []);
    handler(event, { port: 9090 });
    assert.deepEqual(calls, [9090]);
});
