"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { registerNavigationIpc } = require("../../main/dist/electron/features/navigation/register-navigation-ipc");
const { registerPublicContentIpc } = require("../../main/dist/electron/features/network/register-public-content-ipc");

test("native navigation authorizes the dashboard frame and rejects executable URLs and arbitrary folders", async () => {
    const handlers = {}, calls = [], owner = { mainFrame: {} };
    registerNavigationIpc({ ipcMain: { handle: (name, callback) => { handlers[name] = callback; } }, getMainWindow: () => ({ webContents: owner }),
        app: { getPath: name => ({ home: "/fixture", exe: "/app/app.exe", userData: "/gui" })[name] }, path: path.posix,
        fs: { statSync: () => ({ isDirectory: () => true }), realpathSync: value => value },
        shell: { openExternal: value => calls.push(value), openPath: value => calls.push(value), showItemInFolder: value => calls.push(value) } });
    const event = { sender: owner, senderFrame: owner.mainFrame };
    assert.throws(() => handlers["external-navigation"]({ ...event, senderFrame: {} }, "https://example.invalid"), /sender/);
    for (const url of ["file:///tmp/app.exe", "javascript:alert(1)", "http://remote.invalid"]) assert.throws(() => handlers["external-navigation"](event, url), /Unsupported/);
    handlers["external-navigation"](event, "https://example.invalid/docs");
    handlers["external-navigation"](event, "http://127.0.0.1:9090/ui");
    assert.throws(() => handlers["application-folder"](event, "home", "/unrelated"), /Unsupported/);
    handlers["application-folder"](event, "home", "/fixture/.config/clash");
    handlers["application-folder"](event, "gui");
    assert.deepEqual(calls, ["https://example.invalid/docs", "http://127.0.0.1:9090/ui", "/fixture/.config/clash", "/gui"]);
});

test("public content exposes only fixed hosts and snippet identities, bounded responses and no redirects", async () => {
    const owner = { mainFrame: {} }, calls = [];
    let handler;
    registerPublicContentIpc({ ipcMain: { handle(_name, callback) { handler = callback; } }, getMainWindow: () => ({ webContents: owner }),
        axios: { async get(url, options) { calls.push({ url, options }); return { status: 200, data: {} }; } } });
    const event = { sender: owner, senderFrame: owner.mainFrame };
    await assert.rejects(handler({ ...event, senderFrame: {} }, "update"), /sender/);
    await assert.rejects(handler(event, "https://unrelated.invalid"), /Unsupported/);
    for (const section of ["../secret", "//unrelated.invalid", "rules?query=1"]) await assert.rejects(handler(event, "snippets", section), /Unsupported/);
    await handler(event, "snippets", "rules");
    await handler(event, "update");
    await handler(event, "ads");
    assert.equal(calls.length, 3);
    for (const { url, options } of calls) {
        assert.equal(new URL(url).hostname, "raw.githubusercontent.com");
        assert.equal(options.maxRedirects, 0);
        assert.equal(options.maxContentLength, 2097152);
        assert.equal(options.timeout, 20000);
        assert.equal(options.headers, undefined);
    }
});
