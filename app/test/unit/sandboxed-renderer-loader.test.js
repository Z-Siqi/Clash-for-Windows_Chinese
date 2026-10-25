"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");
const { installSandboxedRenderer } = require("../../main/dist/electron/entry/main/load-sandboxed-renderer");

test("sandbox loader injects only integrity-checked fixed assets, with Monaco before the renderer", async () => {
    let ready, code;
    const loaded = [], renderer = "globalThis.rendererStarted = globalThis.monacoLoaded;";
    installSandboxedRenderer({ window: { webContents: { on(_event, callback) { ready = callback; }, async executeJavaScriptInIsolatedWorld(world, scripts) { assert.equal(world, 999); code = scripts[0].code; } } },
        fs: { existsSync: () => true, readFileSync(file) {
            loaded.push(file);
            if (file.endsWith("manifest.json")) return JSON.stringify({
                sha256: crypto.createHash("sha256").update(renderer).digest("hex"),
                connectionsWorkerSha256: crypto.createHash("sha256").update(renderer).digest("hex")
            });
            return file.endsWith("monaco.js") ? "globalThis.monacoLoaded = true;" : renderer;
        } }, path: path.posix, crypto, pathToFileURL,
        dirname: "/fixture/dist/electron", staticRoot: "/fixture/static", platform: "linux", arch: "x64", cwd: "/fixture", systemLanguage: "zh-Hans-CN" });
    await ready();
    assert.equal(loaded.length, 4);
    const context = vm.createContext({});
    vm.runInContext(code, context);
    assert.equal(context.rendererStarted, true);
    assert.equal(context.__CFW_BOOTSTRAP__.platform, "linux");
    assert.equal(context.__CFW_BOOTSTRAP__.systemLanguage, "zh-Hans-CN");
    assert.equal(context.__CFW_BOOTSTRAP__.connectionsWorker,
        pathToFileURL("/fixture/dist/electron/generated/renderer/connections-worker.js").href);
    assert.equal(context.__static, "/fixture/static");
    assert.equal(context.require, undefined);
});

test("sandbox loader rejects a changed worker before executing any renderer assets", async t => {
    let ready, executed = false;
    t.mock.method(console, "error", () => {});
    const digest = crypto.createHash("sha256").update("renderer").digest("hex");
    installSandboxedRenderer({ window: { webContents: {
        on(_event, callback) { ready = callback; }, executeJavaScriptInIsolatedWorld() { executed = true; }
    } }, fs: { existsSync: () => true, readFileSync(file) {
        if (file.endsWith("manifest.json")) return JSON.stringify({ sha256: digest, connectionsWorkerSha256: digest });
        return file.endsWith("connections-worker.js") ? "changed" : "renderer";
    } }, path: path.posix, crypto, pathToFileURL, dirname: "/fixture/dist/electron", staticRoot: "/fixture/static" });
    await ready();
    assert.equal(executed, false);
});
