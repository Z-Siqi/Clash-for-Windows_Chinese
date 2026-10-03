"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createUpdateRuntime } = require("../../main/dist/electron/features/application/update-runtime");

function harness({ isMacOS = false } = {}) {
    const listeners = new Map(), invokes = [], commits = [], removed = [], commands = [];
    const ipcRenderer = {
        async invoke(...args) {
            invokes.push(args);
            if (args[0] === "start-download") return path.join("C:/temp", isMacOS ? "cfw-update.dmg" : "cfw-update.exe");
            if (args[0] === "app" && args[1] === "getName") return "Clash for Windows";
        },
        on(channel, listener) { listeners.set(channel, listener); },
        removeListener(channel, listener) { removed.push([channel, listener]); listeners.delete(channel); }
    };
    const runtime = createUpdateRuntime({
        isMacOS,
        path,
        ipcRenderer,
        store: { commit: (name, payload) => commits.push([name, payload]) },
        execFileSync: (command, args, options) => {
            commands.push([command, args, options]);
            return Buffer.from("/Volumes/Clash for Windows 0.20.39\n");
        }
    });
    return { runtime, listeners, invokes, commits, removed, commands };
}

test("a completed download waits for the host-selected target even when IPC replies later", async () => {
    let onDownload, reply;
    const runtime = createUpdateRuntime({
        ipcRenderer: {
            on(_channel, listener) { onDownload = listener; }, removeListener() {},
            invoke() { return new Promise(resolve => { reply = resolve; }); }
        }, store: { commit() {} }
    });
    const completion = runtime.download("https://example/update.exe");
    onDownload({}, "completed");
    reply("host-selected.exe");
    assert.equal(await completion, "host-selected.exe");
});

test("update runtime reports download progress, resolves the target and removes its listener", async () => {
    const state = harness();
    const result = state.runtime.install("https://example/update.exe");
    await new Promise(resolve => setImmediate(resolve));
    state.listeners.get("download")({}, "downloading", 0.5);
    state.listeners.get("download")({}, "completed");
    assert.equal(await result, path.join("C:/temp", "cfw-update.exe"));
    assert.deepEqual(state.invokes.slice(0, 2), [
        ["start-download", "https://example/update.exe"]
    ]);
    assert.deepEqual(state.commits.map(entry => entry[1].progress), [0.01, 0.5, null]);
    assert.equal(state.removed.length, 1);
});

test("update runtime rejects failed downloads and installs a macOS disk image", async () => {
    const failed = harness();
    const rejection = failed.runtime.install("https://example/update.exe").then(() => null, error => error);
    await new Promise(resolve => setImmediate(resolve));
    failed.listeners.get("download")({}, "failed", "network error");
    assert.equal(await rejection, "network error");

    const mac = harness({ isMacOS: true });
    const installation = mac.runtime.install("https://example/update.dmg");
    await new Promise(resolve => setImmediate(resolve));
    mac.listeners.get("download")({}, "completed");
    assert.equal(await installation, path.join("C:/temp", "cfw-update.dmg"));
    assert.deepEqual(mac.commands[0].slice(0, 2), ["hdiutil", ["attach", path.join("C:/temp", "cfw-update.dmg"), "-nobrowse"]]);
    assert.equal(mac.commands[1][0], "cp");
    assert.equal(mac.commands[2][1][0], "eject");
});
