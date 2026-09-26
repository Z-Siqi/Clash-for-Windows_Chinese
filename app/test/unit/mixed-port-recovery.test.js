"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const getPort = require("../../main/node_modules/get-port");
const {
    isTcpPortAvailable,
    findAvailableTcpPort,
    applyAndVerifyMixedPort,
    confirmMixedPortConflict,
    recoverWithRandomPort
} = require("../../main/dist/electron/core/network/mixed-port-recovery");

test("TCP port checks reject an occupied port and random selection is rechecked", async t => {
    const server = net.createServer();
    await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
    t.after(() => server.close());
    assert.equal(await isTcpPortAvailable({ net, port: server.address().port, host: "127.0.0.1" }), false);
    const available = await findAvailableTcpPort({ getPort, net });
    assert.ok(Number.isInteger(available) && available > 0);
    assert.equal(await isTcpPortAvailable({ net, port: available }), true);
});

test("mixed port application is accepted only after the core reports the requested listener", async () => {
    let configured = 0;
    const calls = [];
    const clashApi = {
        async patchConfig(value) { calls.push(["patch", value]); configured = value["mixed-port"]; return { status: 204 }; },
        async getConfig() { calls.push(["get"]); return { status: 200, data: { "mixed-port": configured } }; }
    };
    assert.equal(await applyAndVerifyMixedPort({ clashApi, port: 23456, sleep: async () => {} }), true);
    assert.deepEqual(calls, [["patch", { "mixed-port": 23456 }], ["get"]]);
});

test("mixed port conflict requires consecutive connected-core confirmations", async () => {
    const values = [0, 7890];
    const transient = await confirmMixedPortConflict({
        clashApi: { getConfig: async () => ({ status: 200, data: { "mixed-port": values.shift() } }) },
        sleep: async () => {}
    });
    assert.equal(transient, false);

    let probes = 0;
    const persistent = await confirmMixedPortConflict({
        clashApi: {
            getConfig: async () => {
                probes += 1;
                return { status: 200, data: { "mixed-port": 0 } };
            }
        },
        sleep: async () => {}
    });
    assert.equal(persistent, true);
    assert.equal(probes, 3);

    assert.equal(await confirmMixedPortConflict({
        clashApi: { getConfig: async () => ({ status: 503, data: { "mixed-port": 0 } }) },
        sleep: async () => {}
    }), false);
});

test("random recovery excludes a candidate rejected by the core and retries", async () => {
    const candidates = [24001, 24002];
    let index = 0;
    const patched = [];
    const clashApi = {
        async patchConfig(value) { patched.push(value["mixed-port"]); return { status: 204 }; },
        async getConfig() {
            const requested = patched.at(-1);
            return { status: 200, data: { "mixed-port": requested === 24001 ? 0 : requested } };
        }
    };
    const fakeNet = {
        createServer() {
            const handlers = {};
            return {
                once(name, handler) { handlers[name] = handler; return this; },
                removeAllListeners() {},
                listen() { handlers.listening(); },
                close(callback) { callback(); }
            };
        }
    };
    const port = await recoverWithRandomPort({
        getPort: async () => candidates[index++], net: fakeNet, clashApi,
        sleep: async () => {}, attempts: 2
    });
    assert.equal(port, 24002);
    assert.deepEqual(patched, [24001, 24002]);
});
