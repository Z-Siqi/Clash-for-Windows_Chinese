"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { registerApplicationLogIpc } = require("../../main/dist/electron/features/logs/register-application-log-ipc");

function harness(t, filesystem = fs) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-app-log-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const owner = { mainFrame: {} }, opened = [];
    let handler, write;
    const written = [];
    registerApplicationLogIpc({
        ipcMain: {
            handle(channel, callback) { assert.equal(channel, "application-log-open"); handler = callback; },
            on(channel, callback) { assert.equal(channel, "application-log-write"); write = callback; }
        },
        getMainWindow: () => ({ webContents: owner }), app: { getPath: name => { assert.equal(name, "temp"); return root; } },
        fs: filesystem, path, shell: { openPath: target => opened.push(target) },
        logger: { info: (...messages) => written.push(messages), transports: { console: {}, file: { getFile: () => ({ path: path.join(root, "gui", "main.log") }) } } },
        getSensitiveValues: () => ["sensitive-fixture-value"]
    });
    return { root, opened, written, write, handler, event: { sender: owner, senderFrame: owner.mainFrame } };
}

test("application logs accept only fixed identities and the dashboard main frame", async t => {
    const host = harness(t);
    await assert.rejects(host.handler({ ...host.event, senderFrame: {} }, "parser"), /sender/);
    await assert.rejects(host.handler(host.event, "../unrelated"), /Unsupported/);
    await host.handler(host.event, "parser");
    await host.handler(host.event, "script");
    await host.handler(host.event, "gui");
    assert.deepEqual(fs.readdirSync(host.root).sort(), ["cfw-parser.log", "cfw-script.log"]);
    assert.deepEqual(host.opened, [path.join(host.root, "cfw-parser.log"), path.join(host.root, "cfw-script.log"), path.join(host.root, "gui")]);
});

test("application logs reject an existing symbolic-link target without following or overwriting it", async t => {
    const host = harness(t, Object.assign({}, fs, { lstatSync() { return { isSymbolicLink: () => true }; } }));
    const target = path.join(host.root, "cfw-script.log");
    fs.writeFileSync(target, "preserved");
    await assert.rejects(host.handler(host.event, "script"), /Invalid/);
    assert.equal(fs.readFileSync(target, "utf8"), "preserved");
    assert.deepEqual(host.opened, []);
});

test("application log writes authorize frames, bound messages and redact controller credentials", t => {
    const host = harness(t);
    host.write({ ...host.event, senderFrame: {} }, "info", ["foreign"]);
    host.write(host.event, "info", ["x".repeat(8193)]);
    host.write(host.event, "unknown", ["invalid"]);
    assert.deepEqual(host.written, []);
    host.write(host.event, "info", ["value: sensitive-fixture-value"]);
    assert.deepEqual(host.written, [["value: <redacted>"]]);
});
