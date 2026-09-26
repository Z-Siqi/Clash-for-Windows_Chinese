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
            if (args[0] === "app" && args[1] === "getPath") return "C:/temp";
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
        execSync: (command, options) => {
            commands.push([command, options]);
            return Buffer.from("/Volumes/Clash for Windows 0.20.39\n");
        }
    });
    return { runtime, listeners, invokes, commits, removed, commands };
}

test("update runtime reports download progress, resolves the target and removes its listener", async () => {
    const state = harness();
    const result = state.runtime.install("https://example/update.exe");
    await new Promise(resolve => setImmediate(resolve));
    state.listeners.get("download")({}, "downloading", 0.5);
    state.listeners.get("download")({}, "completed");
    assert.equal(await result, path.join("C:/temp", "cfw-update.exe"));
    assert.deepEqual(state.invokes.slice(0, 2), [
        ["app", "getPath", "temp"],
        ["start-download", "https://example/update.exe", path.join("C:/temp", "cfw-update.exe")]
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
    assert.match(mac.commands[0][0], /^hdiutil attach/);
    assert.match(mac.commands[1][0], /cp -R/);
    assert.match(mac.commands[2][0], /^hdiutil eject/);
});
