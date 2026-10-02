"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { registerProviderFileIpc } = require("../../main/dist/electron/features/providers/register-provider-file-ipc");

function harness(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-provider-file-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const home = path.join(root, ".config", "clash"), hash = "a".repeat(32);
    const target = path.join(home, "providers", "proxy", `${hash}.yaml`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "proxies: []");
    const owner = { mainFrame: {} }, providers = { "proxy-providers": { cached: { path: `./providers/proxy/${hash}.yaml` } } };
    const calls = [];
    let handler, selected = [];
    registerProviderFileIpc({
        ipcMain: { handle(channel, callback) { assert.equal(channel, "provider-file"); handler = callback; } },
        app: { getPath: name => name === "home" ? root : path.join(root, "app.exe") }, getMainWindow: () => ({ webContents: owner }),
        fs, path, platform: "linux", getProviders: () => providers,
        dialog: { async showOpenDialog() { calls.push("dialog"); return { canceled: selected.length === 0, filePaths: selected }; } },
        shell: { openPath: file => calls.push(file), showItemInFolder: file => calls.push(file) }
    });
    const event = { sender: owner, senderFrame: owner.mainFrame };
    return { root, home, target, hash, calls, providers, handler, event, select: files => { selected = files; } };
}

test("provider files resolve active names and fixed hashes without accepting caller paths", async t => {
    const host = harness(t), request = { home: host.home, kind: "proxy", name: "cached", path: "unrelated" };
    assert.deepEqual(await host.handler(host.event, "read", request), { ok: true, value: "proxies: []" });
    assert.equal((await host.handler(host.event, "write", { ...request, source: "proxies: [one]" })).ok, true);
    assert.equal(fs.readFileSync(host.target, "utf8"), "proxies: [one]");
    assert.equal((await host.handler(host.event, "find-cache", { home: host.home, hash: host.hash })).value, "proxy");
    await host.handler(host.event, "reveal-cache", { home: host.home, hash: host.hash });
    assert.equal(host.calls.at(-1), host.target);
    for (const [event, invalid] of [[{ ...host.event, senderFrame: {} }, request], [host.event, { ...request, name: "unknown" }], [host.event, { ...request, kind: "../" }], [host.event, { ...request, home: host.root }]]) {
        assert.equal((await host.handler(event, "read", invalid)).ok, false);
    }
    assert.equal((await host.handler(host.event, "find-cache", { home: host.home, hash: "../" })).ok, false);
});

test("a file provider outside the fixed cache requires a matching native selection", async t => {
    const host = harness(t), outside = path.join(host.root, "local.yaml");
    fs.writeFileSync(outside, "local");
    host.providers["proxy-providers"].local = { path: outside };
    const request = { home: host.home, kind: "proxy", name: "local" };
    assert.equal((await host.handler(host.event, "read", request)).ok, false);
    host.select([host.target]);
    assert.equal((await host.handler(host.event, "read", request)).ok, false);
    host.select([outside]);
    assert.equal((await host.handler(host.event, "read", request)).value, "local");
    host.select([]);
    assert.equal((await host.handler(host.event, "write", { ...request, source: "updated" })).ok, true);
    assert.equal(fs.readFileSync(outside, "utf8"), "updated");
    assert.equal(host.calls.filter(value => value === "dialog").length, 3);
});
