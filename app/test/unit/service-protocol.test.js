"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createClashServiceApi } = require("../../main/dist/electron/core/network/clash-service-api");
const { createServiceModeManager } = require("../../main/dist/electron/features/service-mode/service-mode-manager");

test("an old helper's successful ping cannot masquerade as authenticated Service Mode", async () => {
    let headers = {};
    const api = createClashServiceApi({
        getCredentials: () => ({ dataDirectory: "/fixture", token: "a".repeat(64) }),
        client: { get: async () => ({ status: 200, headers, data: "pong" }) }
    });
    await assert.rejects(api.ping(), { code: "CFW_SERVICE_UPDATE_REQUIRED" });
    headers = { "x-cfw-service-protocol": "2" };
    assert.equal((await api.ping()).status, 200);
});

test("Windows installation permits a 12-second cold start and waits for a verified helper", async () => {
    let clock = 0, attempts = 0;
    const manager = createServiceModeManager({
        platform: "win32", arch: "x64", path: path.win32,
        fs: { readFileSync: () => JSON.stringify({ cores: [{ name: "clash-win64.exe" }] }), existsSync: () => false },
        getFilesPath: () => "C:\\fixture", getClashPath: () => "C:\\fixture-home",
        prepareCredentials: () => ({ file: "C:\\fixture-home\\credentials" }),
        sudoExec: (_command, _options, callback) => callback(null, "", ""),
        now: () => clock, sleep: async milliseconds => { clock += milliseconds; },
        serviceApi: { ping: async () => { attempts++; if (clock < 12000) throw Error("cold startup"); return { status: 200 }; } }
    });
    await manager.installService();
    assert.equal(clock, 12000);
    assert.equal(attempts, 121);
});

test("legacy shutdown uses only credential-free loopback probes and excludes v2 helpers", async () => {
    const calls = [];
    let probe = { status: 200, headers: {} };
    const api = createClashServiceApi({
        getCredentials: () => { throw Error("legacy migration must not read credentials"); },
        client: { get: async (url, options) => {
            calls.push({ url, options });
            return url.endsWith("/ping") ? probe : { status: 200 };
        } }
    });
    assert.equal(await api.shutdownLegacy(), true);
    assert.deepEqual(calls.map(call => call.url), ["http://127.0.0.1:53000/ping", "http://127.0.0.1:53000/shutdown"]);
    assert.ok(calls.every(call => call.options.proxy === false && !call.options.headers));
    for (const response of [{ status: 403, headers: {} }, { status: 200, headers: { "x-cfw-service-protocol": "2" } }]) {
        calls.length = 0;
        probe = response;
        assert.equal(await api.shutdownLegacy(), false);
        assert.equal(calls.length, 1);
    }
});

test("Windows reinstall retires the legacy helper before credentials rotate and verifies WinSW startup", async () => {
    const events = [];
    const directory = "C:\\Program Files\\Clash for Windows Service";
    const manager = createServiceModeManager({
        platform: "win32", arch: "x64", path: path.win32,
        fs: {
            existsSync: file => file === directory || file.startsWith(directory + "\\"),
            lstatSync: () => ({ isDirectory: () => true }),
            readFileSync: () => JSON.stringify({ cores: [{ name: "clash-win64.exe" }] })
        },
        getFilesPath: () => "C:\\fixture", getClashPath: () => "C:\\fixture-home",
        prepareCredentials: () => { events.push("credentials"); return { file: "C:\\fixture-home\\credentials" }; },
        sudoExec: (command, _options, callback) => { events.push(command.includes("schtasks /delete") ? "uninstall" : "install"); callback(null, "", ""); },
        serviceApi: {
            shutdown: async () => { events.push("authenticated shutdown"); throw Error("old protocol"); },
            shutdownLegacy: async () => { events.push("legacy shutdown"); return true; },
            stop: async () => { throw Error("already stopped"); },
            ping: async () => { events.push("verified ping"); return { status: 200 }; }
        }
    });
    await manager.installService(1);
    assert.deepEqual(events, ["authenticated shutdown", "legacy shutdown", "uninstall", "credentials", "install", "verified ping"]);
});
