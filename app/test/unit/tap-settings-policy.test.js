"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createTunRuntime } = require("../../main/dist/electron/features/tun/tun-runtime");
const { createTunClient } = require("../../main/dist/electron/core/native/tun-client");

test("TAP settings reject shell fragments and regex syntax before any native operation", () => {
    for (const field of ["ip", "subnet", "gateway"]) {
        for (const value of ["10.0.0.1 & whoami", "10x0x0x1", "10.0.0.1|other", "::1"]) {
            assert.throws(() => createTunRuntime({ path, tapInfo: { [field]: value } }), /IPv4 literals/);
        }
    }
});

test("TAP route detection compares columns on one line and never interpolates a regex or shell command", async () => {
    const calls = []; let time = 0;
    const runtime = createTunRuntime({
        path, platform: "win32", arch: "x64", filesPath: "packaged", logger: { info() {} }, now: () => time, sleep: async ms => { time += ms; },
        childProcess: {
            spawn: () => ({ pid: 123 }),
            execFile(file, args, _options, callback) {
                calls.push([file, args]);
                callback(null, "10.0.0.0 255.255.255.0 192.0.2.1\n192.0.2.0 255.255.255.0 10.0.0.1");
            }
        }
    });
    await assert.rejects(runtime.spawnTun2socks({ currentProcess: null, mixedPort: 7890 }), /route did not become ready/);
    assert.equal(calls.some(([file, args]) => file === "route" && args[0] === "add"), false);
    const stopped = calls.filter(([file]) => file === "taskkill").length;
    assert.equal(stopped, 1);
    await runtime.killSpawned({ pid: "123 & whoami" });
    assert.equal(calls.filter(([file]) => file === "taskkill").length, stopped);
});

test("TAP client stops only the host-owned process without forwarding renderer PID or command choices", async () => {
    const calls = [];
    const client = createTunClient({ getTapInfo: () => ({ ip: "10.0.0.1" }), tun: {
        setup: (...args) => calls.push(["setup", ...args]),
        start: (...args) => calls.push(["start", ...args]),
        stop: (...args) => calls.push(["stop", ...args])
    } });
    await client.killSpawned({ pid: 999 });
    assert.deepEqual(calls, [["stop"]]);
    assert.equal(client.sudoRun, undefined);
});
