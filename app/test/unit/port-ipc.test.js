"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const getPort = require("../../main/node_modules/get-port");
const { registerPortIpc } = require("../../main/dist/electron/features/network/register-port-ipc");
const { recoverWithRandomPort } = require("../../main/dist/electron/core/network/mixed-port-recovery");

test("port IPC checks real loopback sockets and rejects foreign frames and invalid ports", async t => {
    const owner = { mainFrame: {} };
    let handler;
    registerPortIpc({ ipcMain: { handle(channel, callback) { assert.equal(channel, "loopback-port"); handler = callback; } }, getMainWindow: () => ({ webContents: owner }), net, getPort });
    const event = { sender: owner, senderFrame: owner.mainFrame };
    await assert.rejects(handler({ ...event, senderFrame: {} }, "random"), /sender/);
    for (const port of [0, 65536, 2.5, "bad"]) await assert.rejects(handler(event, "available", port), /Invalid/);
    await assert.rejects(handler(event, "connect", 1), /unavailable/);
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => listener.close(resolve)));
    assert.equal(await handler(event, "available", listener.address().port), false);
    const random = await handler(event, "random");
    assert.ok(Number.isInteger(random) && random > 0 && random <= 65535);
    assert.equal(await handler(event, "available", random), true);
});

test("renderer mixed-port recovery works with a semantic port checker and no native net object", async () => {
    const checked = [], candidates = [21000, 21001];
    let chosen;
    const port = await recoverWithRandomPort({
        getPort: async () => candidates.shift(), checkPort: async value => { checked.push(value); return value === 21001; },
        clashApi: { async patchConfig(config) { chosen = config["mixed-port"]; return { status: 204 }; }, async getConfig() { return { status: 200, data: { "mixed-port": chosen } }; } },
        sleep: async () => {}
    });
    assert.equal(port, 21001);
    assert.deepEqual(checked, [21000, 21001]);
});
