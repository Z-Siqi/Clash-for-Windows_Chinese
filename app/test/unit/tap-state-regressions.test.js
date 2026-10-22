"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");
const { createTunRuntime } = require("../../main/dist/electron/features/tun/tun-runtime");
const { tapRouteState } = require("../../main/dist/electron/features/tun/tap-route-state");

const addresses = { ip: "10.0.0.1", subnet: "255.255.255.0", gateway: "10.0.0.0" };
const connected = "10.0.0.0 255.255.255.0 在链路上 10.0.0.1 257";
const defaultRoute = gateway => `0.0.0.0 0.0.0.0 ${gateway} 10.0.0.1 2`;

function routeFixture({ gateway = addresses.gateway, routeOutput, addError, queryDelay = 0 } = {}) {
    let time = 0, added = false;
    const calls = [], processHandle = new EventEmitter(); processHandle.pid = 42;
    const runtime = createTunRuntime({ path, platform: "win32", arch: "x64", filesPath: "packaged", logger: { info() {} },
        tapInfo: { ...addresses, gateway }, now: () => time, sleep: async ms => { time += ms; },
        readTapState: async timeout => { time += queryDelay; assert.ok(timeout <= 10000); return { exists: true, configured: true, interfaceIndex: 77 }; },
        childProcess: { spawn: () => processHandle, execFile(file, args, _options, callback) {
            calls.push([file, ...args]);
            if (file === "route" && args[0] === "print") return callback(null, routeOutput({ time, added, processHandle }));
            if (file === "route" && args[0] === "add") { added = true; return callback(addError); }
            callback(null, "");
        } }
    });
    return { runtime, calls, processHandle, get time() { return time; } };
}

test("route parsing accepts localized active rows and excludes persistent or other-interface routes", () => {
    assert.deepEqual(tapRouteState(`${connected}\n${defaultRoute(addresses.gateway)}`, addresses), { connected: true, defaultRoute: true });
    assert.deepEqual(tapRouteState("0.0.0.0 0.0.0.0 10.0.0.0 1\n0.0.0.0 0.0.0.0 10.0.0.0 192.0.2.1 1", addresses), { connected: false, defaultRoute: false });
});

test("an existing active TAP default route succeeds without a duplicate ADD", async () => {
    const state = routeFixture({ routeOutput: () => `${connected}\n${defaultRoute(addresses.gateway)}` });
    assert.equal(await state.runtime.spawnTun2socks({ mixedPort: 7890 }), state.processHandle);
    assert.deepEqual(state.calls, [["route", "print", "-4"]]);
});

test("PnP readiness after the old two-second timeout succeeds within the new bounded budget", async () => {
    const state = routeFixture({ routeOutput: ({ time }) => time >= 3250 ? defaultRoute(addresses.gateway) : "" });
    assert.equal(await state.runtime.spawnTun2socks({ mixedPort: 7890 }), state.processHandle);
    assert.equal(state.time, 3250);
    assert.equal(state.calls.some(call => call[0] === "taskkill"), false);
});

test("custom gateways use the connected subnet and ADD targets the verified TAP interface", async () => {
    const gateway = "10.0.0.254";
    const state = routeFixture({ gateway, routeOutput: ({ added }) => `${connected}\n${added ? defaultRoute(gateway) : ""}` });
    await state.runtime.spawnTun2socks({ mixedPort: 7890 });
    assert.deepEqual(state.calls.filter(call => call[1] === "add"), [["route", "add", "0.0.0.0", "mask", "0.0.0.0", gateway, "metric", "1", "if", "77"]]);
    assert.equal(state.calls.filter(call => call[1] === "print").length, 2, "ADD is followed by independent readiness verification");
});

test("a concurrent route owner completing ADD is verified instead of rejected for an already-existing route", async () => {
    const state = routeFixture({ addError: Error("object already exists"), routeOutput: ({ added }) => added ? defaultRoute(addresses.gateway) : connected });
    assert.equal(await state.runtime.spawnTun2socks({ mixedPort: 7890 }), state.processHandle);
});

test("an ADD that never produces an active route fails and stops the owned process", async () => {
    const state = routeFixture({ addError: Error("access denied"), routeOutput: () => connected });
    await assert.rejects(state.runtime.spawnTun2socks({ mixedPort: 7890 }), /10 seconds.*access denied/);
    assert.equal(state.time, 10000);
    assert.deepEqual(state.calls.at(-1), ["taskkill", "/F", "/PID", "42"]);
});

test("an adapter query consuming the remaining budget cannot add a late route", async () => {
    const state = routeFixture({ queryDelay: 10000, routeOutput: () => connected });
    await assert.rejects(state.runtime.spawnTun2socks({ mixedPort: 7890 }), /10 seconds/);
    assert.equal(state.calls.some(call => call[1] === "add"), false);
});

test("a native TAP process exiting during route discovery cannot report success", async () => {
    const state = routeFixture({ routeOutput: ({ processHandle }) => { processHandle.emit("exit", 1, null); return defaultRoute(addresses.gateway); } });
    await assert.rejects(state.runtime.spawnTun2socks({ mixedPort: 7890 }), /exited before TAP was ready/);
});

function installFixture({ before = { exists: false, configured: false }, after, error, output = "" }) {
    let reads = 0, commands = 0;
    const commandLines = [];
    const runtime = createTunRuntime({ path, platform: "win32", arch: "x64", filesPath: "packaged",
        readTapState: async () => ++reads === 1 ? before : after,
        childProcess: { execFile(_file, _args, _options, callback) { callback(null, ""); },
            exec(command, _options, callback) { commands++; commandLines.push(command); callback(error, output); } }
    });
    return { runtime, commandLines, get commands() { return commands; } };
}

test("missing TAP launches installation while an existing incomplete adapter selects bounded repair", async () => {
    for (const exists of [false, true]) {
        const state = installFixture({ before: { exists, configured: false }, after: { exists: true, configured: true } });
        assert.equal(await state.runtime.setupTapDevice(), true);
        assert.equal(state.commands, 1);
        assert.equal(state.commandLines[0].endsWith(" configure"), exists);
        assert.match(state.commandLines[0], /add_tap_device\.bat/);
    }
});

test("verified installed/configured state wins over timeout, reboot and other installer exit errors", async () => {
    for (const [error, output] of [[Error("exit 10"), "CFW_TAP_SETUP_TIMEOUT"], [Error("exit 3010"), ""], [Error("exit 1"), ""], [null, ""]]) {
        const state = installFixture({ after: { exists: true, configured: true }, error, output });
        assert.equal(await state.runtime.setupTapDevice(), true);
        assert.equal(state.commands, 1);
    }
});

test("a disconnected but configured TAP installation is idempotent and skips the installer", async () => {
    const state = installFixture({ before: { exists: true, configured: true, operationalStatus: "Disconnected" } });
    assert.equal(await state.runtime.setupTapDevice(), true);
    assert.equal(state.commands, 0);
});

test("partial configuration, absent adapter and cancellation remain distinguishable", async () => {
    await assert.rejects(installFixture({ after: { exists: true, configured: false }, error: Error("exit 10"), output: "CFW_TAP_SETUP_TIMEOUT" }).runtime.setupTapDevice(), /installed.*configuration is incomplete/);
    await assert.rejects(installFixture({ after: { exists: false, configured: false } }).runtime.setupTapDevice(), /adapter was not found/);
    assert.equal(await installFixture({ after: { exists: false, configured: false }, error: Error("UAC cancelled") }).runtime.setupTapDevice(), false);
});

test("process cleanup waits for the owned child to exit while the event loop stays responsive", async t => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { windowsHide: true });
    t.after(() => { if (child.exitCode == null && child.signalCode == null) child.kill("SIGKILL"); });
    await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
    const runtime = createTunRuntime({ path, platform: process.platform });
    let tick = false; setImmediate(() => { tick = true; });
    await runtime.killSpawned(child);
    assert.ok(child.exitCode != null || child.signalCode != null);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(tick, true);
});

test("cleanup failure is propagated rather than declaring a running TAP process stopped", async () => {
    const processHandle = Object.assign(new EventEmitter(), { pid: 42, kill: () => false });
    const runtime = createTunRuntime({ path, platform: "win32" });
    await assert.rejects(runtime.killSpawned(processHandle), /Could not stop/);
});
