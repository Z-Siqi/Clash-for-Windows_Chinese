"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const net = require("node:net");
const childProcess = require("node:child_process");
const { createTunRuntime } = require("../../main/dist/electron/features/tun/tun-runtime");
const { createProfileNetworkEffects } = require("../../main/dist/electron/features/network/profile-network-effects");
const { registerNativeAdminIpc } = require("../../main/dist/electron/entry/main/register-native-admin-ipc");
const { registerNetworkInfoIpc } = require("../../main/dist/electron/features/network/register-network-info-ipc");
const { execFileAsync } = require("../../main/dist/electron/core/process/commands");
const { createGeneralPageWorkflow } = require("../../main/dist/electron/features/clash-core/general-page-workflow");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { homePage } = require("../fixtures/home-page");

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

test("a pending TAP lookup leaves the event loop responsive and coalesces concurrent checks", async () => {
    let finish;
    let requests = 0;
    const effects = createProfileNetworkEffects({ childProcess: {
        execFileSync() { assert.fail("TAP discovery must not block Electron's main process"); },
        execFile(file, args, options, callback) {
            assert.equal(file, "netsh");
            assert.deepEqual(args, ["interface", "show", "interface"]);
            assert.ok(options.timeout > 0 && options.timeout <= 10000);
            requests++; finish = callback;
        }
    } });
    const lookup = effects.hasTap();
    assert.equal(effects.hasTap(), lookup);
    await new Promise(setImmediate);
    assert.equal(requests, 1);
    finish(null, "Admin State    State    Type    Interface Name\n--------------------------------------------------\nEnabled    Disconnected    Dedicated    cfw-tap\n");
    assert.equal(await lookup, true);
    const missing = effects.hasTap();
    finish(Object.assign(Error("timed out"), { killed: true }));
    assert.equal(await missing, null);
});

test("uninstall elevation detection and command execution do not use synchronous child processes", async () => {
    const entered = deferred(); let finish;
    const runtime = createTunRuntime({ path, platform: "win32", arch: "x64", filesPath: "packaged", childProcess: {
        execFileSync() { assert.fail("administrator detection must be asynchronous"); },
        execFile(file, args, options, callback) {
            assert.equal(file, "net"); assert.deepEqual(args, ["session"]);
            assert.ok(options.timeout > 0); callback(null, "administrator");
        },
        exec(command, options, callback) {
            assert.match(command, /remove_tap_device\.bat/);
            assert.equal(options.windowsHide, true);
            finish = callback; entered.resolve();
        }
    } });
    const uninstall = runtime.setupTapDevice(false);
    await entered.promise;
    await new Promise(setImmediate);
    finish(null);
    assert.equal(await uninstall, true);
});

test("TAP setup invalidates older discovery work without letting its completion clear a newer lookup", async () => {
    const callbacks = [];
    const effects = createProfileNetworkEffects({ sleep: async () => {}, childProcess: { execFile(_file, _args, _options, callback) { callbacks.push(callback); } } });
    const old = effects.hasTap();
    effects.invalidateTap();
    const current = effects.hasTap();
    assert.notEqual(old, current);
    callbacks[0](null, "Admin State    State    Type    Interface Name\n--------------------------------------------------\nEnabled    Disconnected    Dedicated    cfw-tap\n");
    assert.equal(await old, null, "an invalidated discovery cannot publish its old observation");
    assert.equal(effects.hasTap(), current);
    callbacks[1](null, "Admin State    State    Type    Interface Name\n--------------------------------------------------\nEnabled    Connected    Dedicated    Ethernet\n");
    await new Promise(setImmediate);
    callbacks[2](null, "Admin State    State    Type    Interface Name\n--------------------------------------------------\nEnabled    Connected    Dedicated    Ethernet\n");
    assert.equal(await current, false);
});

test("cancellation during an asynchronous route query stops TAP without adding a default route", async () => {
    let current = true, completeQuery;
    const calls = [];
    const runtime = createTunRuntime({ path, platform: "win32", arch: "x64", filesPath: "packaged", logger: { info() {} },
        childProcess: {
            spawn: () => ({ pid: 123 }),
            execFileSync() { assert.fail("route and process commands must not block the main process"); },
            execFile(file, args, options, callback) {
                calls.push([file, ...args]);
                if (file === "route") completeQuery = callback;
                else callback(null, "");
            }
        }
    });
    const starting = runtime.spawnTun2socks({ mixedPort: 7890, isCurrent: () => current });
    await new Promise(setImmediate);
    current = false;
    completeQuery(null, "10.0.0.0 255.255.255.0 10.0.0.1");
    assert.equal(await starting, null);
    assert.equal(calls.some(call => call[0] === "route" && call[1] === "add"), false);
    assert.deepEqual(calls.at(-1), ["taskkill", "/F", "/PID", "123"]);
});

function nativeHarness(runtime, overrides = {}) {
    const webContents = { mainFrame: {} }, handlers = {};
    let quits = 0;
    let handle;
    registerNativeAdminIpc({ ipcMain: { handle(_channel, callback) { handle = callback; } },
        app: { isPackaged: true, quit: () => { quits++; }, once: (event, callback) => { handlers[event] = callback; }, getPath: name => name === "home" ? "C:\\user" : "C:\\app\\app.exe" },
        getMainWindow: () => ({ webContents }), fs: {}, path: path.win32,
        platform: "win32", arch: "x64", resourcesPath: "C:\\app\\resources", sudoPrompt: { exec() {} }, createTapRuntime: runtime && (() => runtime), ...overrides });
    const event = { sender: webContents, senderFrame: webContents.mainFrame };
    return { handlers, get quits() { return quits; }, networkStatus: () => handle(event, "profile-network", "has-tap", {
        filesPath: "C:\\app\\resources\\static\\files", clashPath: "C:\\user\\.config\\clash"
    }), call: (action, extra = {}) => handle(event, "tun", action, {
        filesPath: "C:\\app\\resources\\static\\files", clashPath: "C:\\user\\.config\\clash", ...extra
    }) };
}

test("TAP installation status is unknown during native setup and confirmed only after enumeration", async () => {
    const setup = deferred();
    const h = nativeHarness({ setupTapDevice: () => setup.promise }, { childProcess: { execFile(_file, _args, _options, callback) {
        callback(null, "Admin State    State    Type    Interface Name\n--------------------------------------------------\nEnabled    Connected    Dedicated    Ethernet\n");
    } } });
    const pending = h.call("setup", { install: false });
    assert.equal(await h.networkStatus(), null);
    setup.resolve(true); await pending;
    assert.equal(await h.networkStatus(), false);
});

test("native TAP stop failure retains process ownership for a retry and blocks driver removal", async () => {
    let failures = 1, stopped = 0, setups = 0;
    const runtime = { spawnTun2socks: async () => ({ pid: 42 }),
        killSpawned: async child => { assert.equal(child.pid, 42); stopped++; if (failures-- > 0) throw Error("cannot stop"); },
        setupTapDevice: async () => { setups++; return true; } };
    const harness = nativeHarness(runtime);
    await harness.call("start", { mixedPort: 7890 });
    await assert.rejects(harness.call("setup", { install: false }), /cannot stop/);
    assert.equal(setups, 0);
    assert.equal(await harness.call("setup", { install: false }), true);
    assert.equal(stopped, 2);
    assert.equal(setups, 1);
});

test("native TAP IPC validates compatibility booleans and passes only the accepted choice", async () => {
    const choices = [];
    const h = nativeHarness({ spawnTun2socks: async ({ allowMulticast }) => { choices.push(allowMulticast); return { pid: 42 }; }, killSpawned: async () => {} });
    await assert.rejects(h.call("start", { mixedPort: 7890, allowMulticast: "true" }), /multicast preference/);
    await h.call("start", { mixedPort: 7890 });
    await h.call("start", { mixedPort: 7890, allowMulticast: true });
    assert.deepEqual(choices, [false, true]);
    await h.call("stop");
});

test("TAP startup failure cannot lose ownership of a child whose cleanup also failed", async () => {
    let stopped = 0;
    const runtime = { async spawnTun2socks({ onSpawn }) { onSpawn({ pid: 43 }); throw Error("startup and cleanup failed"); },
        async killSpawned(child) { assert.equal(child.pid, 43); stopped++; } };
    const harness = nativeHarness(runtime);
    await assert.rejects(harness.call("start", { mixedPort: 7890 }), /startup and cleanup failed/);
    await harness.call("stop");
    assert.equal(stopped, 1);
});

test("uninstall awaits the owned TAP process before removing the driver and blocks replacement starts", async () => {
    const stopped = deferred(), removing = deferred(), entered = deferred(), calls = [];
    const { call } = nativeHarness({
        spawnTun2socks: async () => { calls.push("spawn"); return { pid: 42 }; },
        killSpawned: async process => { assert.equal(process.pid, 42); calls.push("stop"); await stopped.promise; },
        setupTapDevice: async install => { assert.equal(install, false); calls.push("remove"); entered.resolve(); return removing.promise; }
    });
    await call("start", { mixedPort: 7890 });
    const uninstall = call("setup", { install: false });
    await new Promise(setImmediate);
    assert.deepEqual(calls, ["spawn", "stop"]);
    assert.equal(await call("start", { mixedPort: 7890 }), null);
    stopped.resolve(); await entered.promise;
    await new Promise(setImmediate);
    assert.deepEqual(calls, ["spawn", "stop", "remove"]);
    removing.resolve(true); assert.equal(await uninstall, true);
    await call("start", { mixedPort: 7890 });
    assert.equal(calls.at(-1), "spawn");
});

test("adapter-change route refreshes share a bounded asynchronous query without blocking other IPC", async () => {
    let handler, finish;
    const webContents = { mainFrame: {} };
    registerNetworkInfoIpc({ ipcMain: { handle(_name, callback) { handler = callback; } }, getMainWindow: () => ({ webContents }),
        platform: "win32", networkInterfaces: () => ({}), isIP: net.isIP, isIPv4: net.isIPv4,
        execSync() { assert.fail("adapter-change IPC must not execute synchronously"); },
        exec(command, options, callback) {
            assert.equal(command, "route print 0.0.0.0 mask 0.0.0.0");
            assert.ok(options.timeout > 0 && options.timeout <= 10000);
            finish = callback;
        } });
    const event = { sender: webContents, senderFrame: webContents.mainFrame };
    const query = handler(event, "defaultInterface");
    assert.equal(handler(event, "defaultInterface"), query);
    await new Promise(setImmediate);
    assert.deepEqual(handler(event, "interfaces"), []);
    finish(Error("adapter transition timed out"));
    await assert.rejects(query, /timed out/);
    const retry = handler(event, "defaultInterface");
    finish(null, ""); assert.equal(await retry, null);
});

test("native command deadlines terminate a stalled child while the event loop keeps running", async () => {
    const command = execFileAsync(childProcess, process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { timeout: 100 });
    const rejected = assert.rejects(command, error => error.killed === true);
    await new Promise(setImmediate);
    await rejected;
});

test("uninstall also waits for a cancellation already stopping the owned process", async () => {
    const stopped = deferred(), calls = [];
    const { call } = nativeHarness({ spawnTun2socks: async () => ({ pid: 42 }),
        killSpawned: async () => { calls.push("stop"); await stopped.promise; },
        setupTapDevice: async () => { calls.push("remove"); return true; } });
    await call("start", { mixedPort: 7890, requestId: "1-1" });
    const cancellation = call("cancel", { requestId: "1-1" });
    await new Promise(setImmediate);
    const uninstall = call("setup", { install: false });
    await new Promise(setImmediate);
    assert.deepEqual(calls, ["stop"]);
    stopped.resolve(); await Promise.all([cancellation, uninstall]);
    assert.deepEqual(calls, ["stop", "remove"]);
});

test("uninstall cancels a queued startup before running the driver command", async () => {
    const entered = deferred(), resume = deferred(), calls = [];
    const { call } = nativeHarness({ spawnTun2socks: async ({ isCurrent }) => {
        entered.resolve(); await resume.promise;
        calls.push(isCurrent() ? "running" : "cancelled"); return isCurrent() ? { pid: 42 } : null;
    }, setupTapDevice: async () => { calls.push("remove"); return true; } });
    const startup = call("start", { mixedPort: 7890 });
    await entered.promise;
    const uninstall = call("setup", { install: false });
    resume.resolve();
    assert.equal(await startup, null);
    assert.equal(await uninstall, true);
    assert.deepEqual(calls, ["cancelled", "remove"]);
});

test("quitting waits asynchronously for the managed TAP process cleanup", async () => {
    const stopped = deferred(); let prevented = false;
    const harness = nativeHarness({ spawnTun2socks: async () => ({ pid: 42 }), killSpawned: () => stopped.promise });
    await harness.call("start", { mixedPort: 7890 });
    harness.handlers["will-quit"]({ preventDefault() { prevented = true; } });
    await new Promise(setImmediate);
    assert.equal(prevented, true); assert.equal(harness.quits, 0);
    stopped.resolve(); await new Promise(setImmediate);
    assert.equal(harness.quits, 1);
});

test("cancelled or failed TAP removal restores profile policy, reports failure and releases the UI lock", async () => {
    for (const failure of [false, Error("UAC cancelled")]) {
        const calls = [], errors = [], notifications = [];
        const workflow = createGeneralPageWorkflow({ cache: { get() {} }, keys: {},
            getLanguage: () => createTranslator(1), platform: { isWindows: () => true },
            getTapInstalled: async () => { calls.push("status"); return true; }, utilities: { notify: (...args) => notifications.push(args) } });
        const home = { ...homePage().data(), runProxyOperation: homePage().methods.runProxyOperation,
            publishProxyOperation() {}, publishProxyState() {}, $alert: async options => errors.push(options),
            setupTapDevice: async () => { calls.push("remove"); if (failure instanceof Error) throw failure; return failure; },
            refreshProfile: async () => { calls.push("reapply"); return { success: true }; } };
        Object.defineProperty(home, "proxyBusy", { get: () => !!home.proxyOperation });
        const vm = { ...workflow.data(), ...workflow.methods, $parent: home };
        assert.equal(await vm.handleTapManagementAction(1), false);
        assert.deepEqual(calls, ["remove", "reapply", "status"]);
        assert.equal(home.proxyBusy, false);
        assert.equal(errors.length, 1); assert.deepEqual(notifications, []);
        assert.equal(vm.tapInstalled, true);
    }
});

test("invalid legacy TAP addresses cannot prevent safe driver removal, while install still rejects them", async () => {
    const commands = [];
    const harness = nativeHarness(undefined, { childProcess: {
        execFile(_file, _args, _options, callback) { callback(null, "admin"); },
        exec(command, _options, callback) { commands.push(command); callback(null); }
    } });
    const tapInfo = { ip: "old-invalid-address" };
    for (const legacy of [tapInfo, "old-malformed-value", []]) assert.equal(await harness.call("setup", { install: false, tapInfo: legacy }), true);
    assert.match(commands[0], /remove_tap_device\.bat/);
    await assert.rejects(harness.call("setup", { install: true, tapInfo }), /IPv4 literals/);
    assert.equal(commands.length, 3);
});
