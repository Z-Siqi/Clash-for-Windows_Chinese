"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { createMulticastRoutes } = require("../../main/dist/electron/features/tun/multicast-routes");
const { createTunRuntime } = require("../../main/dist/electron/features/tun/tun-runtime");
const { createTunClient } = require("../../main/dist/electron/core/native/tun-client");
const { createNativeAdminClient } = require("../../main/dist/electron/core/native/native-admin-client");

const lease = { changed: true, interfaceIndex: 19, originalMetric: 256, appliedMetric: 4096 };

test("multicast route bypass is bounded and restoration uses only the acquired TAP lease", async () => {
    const calls = [];
    const manager = createMulticastRoutes({ path, filesPath: "packaged", logger: {}, childProcess: {
        execFile(file, args, options, done) { calls.push({ file, args, options }); done(null, args.includes("Acquire") ? JSON.stringify(lease) : ""); }
    } });
    const acquired = await manager.acquire(1234);
    assert.deepEqual(acquired, lease);
    await manager.release(acquired);
    assert.equal(calls[0].file, "powershell.exe");
    assert.equal(calls[0].options.timeout, 1234);
    assert.equal(calls[0].options.windowsHide, true);
    assert.deepEqual(calls[1].args.slice(-8), ["-Action", "Release", "-InterfaceIndex", "19", "-OriginalMetric", "256", "-AppliedMetric", "4096"]);
});

test("route timeout compensates a partial mutation and permission failure retains packet filtering", async () => {
    const calls = [], warnings = [];
    const manager = createMulticastRoutes({ path, filesPath: "packaged", logger: { warn: value => warnings.push(value) }, childProcess: {
        execFile(_file, args, _options, done) {
            calls.push(args);
            if (args.includes("Acquire")) done(Error("access denied or timeout"), JSON.stringify(lease));
            else done(null, "");
        }
    } });
    assert.equal(await manager.acquire(), null);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].includes("Release"));
    assert.match(warnings[0], /filtering remains enabled/);
});

test("failed route preparation retains rollback ownership when immediate compensation also fails", async () => {
    let restores = 0;
    const manager = createMulticastRoutes({ path, filesPath: "packaged", logger: {}, childProcess: {
        execFile(_file, args, _options, done) {
            if (args.includes("Acquire")) done(Error("timed out after mutation"), JSON.stringify(lease));
            else if (++restores === 1) done(Error("restore unavailable"));
            else done(null, "");
        }
    } });
    const retained = await manager.acquire();
    assert.deepEqual(retained, lease);
    await manager.release(retained);
    assert.equal(restores, 2);
});

function runtimeFixture() {
    const events = [], children = [];
    const routes = { acquire: async () => { events.push("acquire"); return lease; }, release: async () => { events.push("release"); } };
    const runtime = createTunRuntime({ path, platform: "win32", arch: "x64", filesPath: "packaged", logger: { info() {} }, multicastRoutes: routes,
        childProcess: {
            spawn(_file, args) {
                const child = new EventEmitter(); child.pid = 42; child.args = args;
                child.kill = () => { events.push("kill"); child.exitCode = 0; child.emit("exit", 0, null); return true; };
                children.push(child); return child;
            },
            execFile(_file, _args, _options, done) { done(null, "0.0.0.0 0.0.0.0 10.0.0.0 10.0.0.1 2"); }
        }
    });
    return { runtime, routes, events, children };
}

test("default TAP startup filters natively and restores route priority once after process exit", async () => {
    const f = runtimeFixture();
    const child = await f.runtime.spawnTun2socks({ mixedPort: 7890 });
    assert.ok(child.args.includes("-allowMulticast=false"));
    await f.runtime.killSpawned(child);
    await f.runtime.killSpawned(child);
    assert.deepEqual(f.events, ["acquire", "kill", "release"]);
});

test("legacy compatibility explicitly allows multicast and leaves route priorities alone", async () => {
    const f = runtimeFixture();
    const child = await f.runtime.spawnTun2socks({ mixedPort: 7890, allowMulticast: true });
    assert.ok(child.args.includes("-allowMulticast=true"));
    await f.runtime.killSpawned(child);
    assert.deepEqual(f.events, ["kill"]);
    await assert.rejects(f.runtime.spawnTun2socks({ mixedPort: 7890, allowMulticast: "true" }), /preference/);
});

test("cancellation and native failure during route preparation release the owned lease", async () => {
    for (const failure of ["cancel", "exit"]) {
        const f = runtimeFixture(); let current = true;
        f.routes.acquire = async () => {
            f.events.push("acquire");
            if (failure === "exit") { f.children[0].exitCode = 1; f.children[0].emit("exit", 1, null); }
            else current = false;
            return lease;
        };
        const start = f.runtime.spawnTun2socks({ mixedPort: 7890, isCurrent: () => current });
        if (failure === "cancel") assert.equal(await start, null);
        else await assert.rejects(start, /exited before TAP/);
        assert.equal(f.events.filter(event => event === "release").length, 1);
    }
});

test("a failed route restoration remains owned for the next cleanup retry", async () => {
    const f = runtimeFixture(); let releases = 0;
    f.routes.release = async () => { if (++releases === 1) throw Error("retry restoration"); };
    const child = await f.runtime.spawnTun2socks({ mixedPort: 7890 });
    await assert.rejects(f.runtime.killSpawned(child), /retry restoration/);
    await f.runtime.killSpawned(child);
    assert.equal(releases, 2);
});

test("the saved compatibility choice reaches native IPC as a boolean without changing TAP addresses", async () => {
    const calls = [], info = { ip: "10.0.0.1" };
    const native = createNativeAdminClient({ ipcRenderer: { invoke: async (...args) => { calls.push(args); return { pid: 1 }; } },
        getFilesPath: () => "packaged", getClashPath: () => "profile", getBinaryPath: () => "core" });
    const client = createTunClient({ tun: native.tun, getTapInfo: () => info });
    await client.spawnTun2socks({ mixedPort: 7890, allowMulticast: true });
    assert.equal(calls[0][3].allowMulticast, true);
    assert.deepEqual(calls[0][3].tapInfo, info);
});
