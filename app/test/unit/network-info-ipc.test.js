"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { registerNetworkInfoIpc } = require("../../main/dist/electron/features/network/register-network-info-ipc");
const { createNetworkInfoClient } = require("../../main/dist/electron/core/native/network-info-client");

function harness() {
    let handler;
    const commands = [];
    const mainFrame = {};
    const webContents = { mainFrame };
    const event = { sender: webContents, senderFrame: mainFrame };
    registerNetworkInfoIpc({
        ipcMain: { handle(channel, callback) { assert.equal(channel, "network-info"); handler = callback; } },
        getMainWindow: () => ({ webContents }), platform: "win32",
        networkInterfaces: () => ({ Ethernet: [{ family: "IPv4", internal: false, address: "192.0.2.10" }] }),
        execSync(command) { commands.push(command); return Buffer.from(""); },
        isIP: net.isIP, isIPv4: net.isIPv4
    });
    return { handler, event, commands };
}

test("network information IPC rejects foreign windows, subframes and arbitrary operations before native access", () => {
    const { handler, event, commands } = harness();
    assert.throws(() => handler({ ...event, sender: {} }, "wlan"), /main frame/);
    assert.throws(() => handler({ ...event, senderFrame: {} }, "wlan"), /main frame/);
    for (const operation of ["exec", "__proto__", "constructor", "wlan; whoami"]) {
        assert.throws(() => handler(event, operation), /Unsupported/);
    }
    assert.deepEqual(commands, []);
});

test("network information client invokes only named operations and returns asynchronous native results", async () => {
    const { handler, event, commands } = harness();
    const client = createNetworkInfoClient({ ipcRenderer: {
        async invoke(channel, operation) { assert.equal(channel, "network-info"); return handler(event, operation); }
    } });
    assert.deepEqual(await client.getNetworkInterfaces(), [{ name: "Ethernet", address: "192.0.2.10" }]);
    assert.equal((await client.getNetworkAddresses()).Ethernet[0].address, "192.0.2.10");
    assert.equal(await client.getDefaultInterface(), null);
    await client.getWlanInterfaces();
    assert.deepEqual(commands, ["route print 0.0.0.0 mask 0.0.0.0", "chcp 65001 && netsh wlan show interfaces"]);
});
