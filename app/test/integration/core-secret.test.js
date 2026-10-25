"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const yaml = require("../../main/node_modules/yaml");
const Vuex = require("../../main/node_modules/vuex");
const axios = require("../../main/node_modules/axios/dist/node/axios.cjs");
const WebSocket = require("../../main/node_modules/ws");
const { createSettingsPageOptions } = require("../../main/dist/electron/features/settings/page-options");
const { createCoreConfigRepository } = require("../../main/dist/electron/features/settings/core-config-repository");
const { updateYamlValue } = require("../../main/dist/electron/core/storage/yaml-file");
const { resolveCoreBinaryPath } = require("../../main/dist/electron/core/clash-core/core-selection");
const { createAxiosClient, createWebSocketFactory } = require("../../main/dist/electron/core/network/clash-clients");

const packages = { "win32:x64": "win_x64", "win32:arm64": "win32-arm64", "linux:x64": "linux-x64",
    "linux:arm64": "linux-arm64", "darwin:x64": "darwin-x64", "darwin:arm64": "darwin-arm64" };
const target = packages[`${process.platform}:${process.arch}`];
const root = path.resolve(__dirname, "../../..");

async function freePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

async function status(port, secret) {
    try { return (await createAxiosClient({ axios, controllerPort: port, secret }).get("/version")).status; }
    catch (error) {
        if (error.response) return error.response.status;
        // Axios errors include request headers. Never expose test credentials.
        throw Error("Test controller is unavailable");
    }
}

function streamStatus(port, secret) {
    return new Promise((resolve, reject) => {
        const socket = createWebSocketFactory({ WebSocket, controllerPort: port, secret })("traffic");
        const timer = setTimeout(() => finish(null), 3000);
        let done = false;
        function finish(code) {
            if (done) return;
            done = true; clearTimeout(timer); socket.terminate();
            if (code === null) reject(Error("Test controller stream is unavailable"));
            else resolve(code);
        }
        socket.on("error", () => { if (!done) finish(null); });
        socket.once("open", () => finish(101));
        socket.once("unexpected-response", (request, response) => {
            finish(response.statusCode); response.resume(); request.destroy();
        });
    });
}

for (const coreType of ["mihomo", "clash"]) test(`Core Secret Generate/Update authenticates HTTP and streams after ${coreType} restarts`, {
    skip: !target && "no packaged core for this platform", timeout: 30000
}, async t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-core-secret-"));
    let child;
    async function stop() {
        if (!child || child.exitCode !== null || child.signalCode !== null) return;
        const owned = child;
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(Error("Test core did not stop")), 5000);
            owned.once("exit", () => { clearTimeout(timer); resolve(); }); owned.kill();
        });
    }
    t.after(async () => { await stop(); fs.rmSync(home, { recursive: true, force: true }); });
    const filesPath = path.join(root, "app/clash_core", target, "static/files");
    const binary = resolveCoreBinaryPath({ path, filesPath, coreType });
    if (process.platform !== "win32") fs.chmodSync(binary, 0o755);
    fs.copyFileSync(path.join(filesPath, "default/Country.mmdb"), path.join(home, "Country.mmdb"));
    const controllerPort = await freePort();
    const file = path.join(home, "config.yaml");
    fs.writeFileSync(file, yaml.stringify({ "external-controller": `127.0.0.1:${controllerPort}`,
        "mixed-port": 0, secret: "", mode: "direct", "log-level": "silent", proxies: [], "proxy-groups": [], rules: [] }));
    const repository = createCoreConfigRepository({ fs, path, yaml });
    async function start() {
        child = spawn(binary, ["-d", home], { windowsHide: true, stdio: "ignore" });
        let failed = false;
        child.once("error", () => { failed = true; });
        const secret = repository.load(home).secret;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
            if (failed || child.exitCode !== null) throw Error("Test core exited before controller startup");
            try { if (await status(controllerPort, secret) === 200) return; } catch (_) {}
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw Error("Test controller did not become ready");
    }
    const labels = new Proxy({}, { get: (_object, key) => () => String(key) });
    const options = createSettingsPageOptions({ Vuex, path, uuid: { v4: randomUUID }, getLanguage: () => labels,
        showMessageBox: async () => ({ response: 1 }),
        updateYaml: async (targetFile, key, value) => updateYamlValue({ fs, path, yaml, file: targetFile, key, value }) });
    let restarts = 0;
    const vm = { clashPath: home, $parent: { runProxyOperation: async (_name, action) => action() },
        async reloadElectron() { restarts++; await stop(); await start(); } };
    await start();
    for (let rotation = 0; rotation < 2; rotation++) {
        const previous = repository.load(home).secret;
        await options.methods.handleGenerateUUIDSecret.call(vm);
        const saved = repository.load(home);
        assert.ok(saved.secret !== previous && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(saved.secret));
        assert.equal(saved["external-controller"], `127.0.0.1:${controllerPort}`);
        assert.equal(saved["mixed-port"], 0);
        assert.equal(await status(controllerPort, saved.secret), 200);
        assert.equal(await status(controllerPort, ""), 401);
        assert.equal(await status(controllerPort, previous), 401);
        assert.equal(await streamStatus(controllerPort, saved.secret), 101);
        assert.equal(await streamStatus(controllerPort, ""), 401);
        assert.equal(await streamStatus(controllerPort, previous), 401);
    }
    assert.equal(restarts, 2);
});
