"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { EventEmitter } = require("node:events");
const yaml = require("../../main/node_modules/yaml");
const { registerExternalEditorIpc, splitEditorCommand, resolveEditorLaunch } = require("../../main/dist/electron/features/settings/register-external-editor-ipc");

test("editor arguments preserve quoted paths without interpreting shell operators", () => {
    assert.deepEqual(splitEditorCommand('"C:\\Program Files\\Editor\\editor.exe" --wait "two words"'), ["C:\\Program Files\\Editor\\editor.exe", "--wait", "two words"]);
    assert.deepEqual(splitEditorCommand("editor --wait && untrusted"), ["editor", "--wait", "&&", "untrusted"]);
    assert.throws(() => splitEditorCommand('editor "unclosed'), /quote/);
    const winPath = path.win32;
    const root = "C:\\tools\\VS Code";
    const files = new Set([winPath.join(root, "bin", "code.cmd"), winPath.join(root, "Code.exe"), winPath.join(root, "resources", "app", "out", "cli.js")]);
    const launch = resolveEditorLaunch({ command: "code --wait", platform: "win32", path: winPath,
        fs: { existsSync: file => files.has(file) }, environment: { PATH: winPath.join(root, "bin") } });
    assert.equal(launch.executable, winPath.join(root, "Code.exe"));
    assert.deepEqual(launch.args, [winPath.join(root, "resources", "app", "out", "cli.js"), "--wait"]);
    assert.equal(launch.env.ELECTRON_RUN_AS_NODE, "1");
});

test("editor IPC selects saved commands, uses one private temporary file and cleans it after completion", async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-editor-ipc-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const home = path.join(root, ".config", "clash");
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, "cfw-settings.yaml"), yaml.stringify({ editor: 2, editorCustomCommand: 'saved-editor --wait "saved argument"' }));
    const mainFrame = {};
    const webContents = Object.assign(new EventEmitter(), { mainFrame });
    let handler; let target; let calls = 0;
    registerExternalEditorIpc({
        ipcMain: { handle(_channel, callback) { handler = callback; } },
        app: { getPath: name => name === "home" || name === "temp" ? root : path.join(root, "app.exe"), once() {} },
        getMainWindow: () => ({ webContents }), fs, path, yaml, environment: {},
        childProcess: { spawn(executable, args, options) {
            calls++; assert.equal(executable, "saved-editor"); assert.deepEqual(args.slice(0, -1), ["--wait", "saved argument"]);
            assert.equal(options.shell, false);
            target = args.at(-1);
            assert.equal(fs.readFileSync(target, "utf8"), "initial content");
            const child = Object.assign(new EventEmitter(), { kill() {} });
            queueMicrotask(() => { fs.writeFileSync(target, "edited content"); child.emit("exit", 0); });
            return child;
        } }
    });
    const event = { sender: webContents, senderFrame: mainFrame };
    const request = { home, language: "yaml", content: "initial content", command: "renderer injection", target: "/arbitrary" };
    assert.throws(() => handler({ ...event, senderFrame: {} }, "edit", request), /sender/);
    assert.throws(() => handler(event, "edit", { ...request, language: "../executable" }), /content/);
    assert.equal(await handler(event, "edit", request), "edited content");
    assert.equal(calls, 1);
    assert.equal(fs.existsSync(target), false);
    assert.equal(fs.readdirSync(root).some(name => name.startsWith("cfw-external-editor-")), false);
});

test("external editor completes a real portable child process using only a temporary document", async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-editor-cli-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const home = path.join(root, ".config", "clash");
    fs.mkdirSync(home, { recursive: true });
    const quote = value => {
        assert.ok(!value.includes('"'), "fixture paths must not contain quotes");
        return `"${value}"`;
    };
    const command = `${quote(process.execPath)} ${quote(path.resolve(__dirname, "../fixtures/external-editor-cli.js"))}`;
    fs.writeFileSync(path.join(home, "cfw-settings.yaml"), yaml.stringify({ editor: 2, editorCustomCommand: command }));
    const mainFrame = {};
    const webContents = Object.assign(new EventEmitter(), { mainFrame });
    let handler;
    registerExternalEditorIpc({
        ipcMain: { handle(_channel, callback) { handler = callback; } },
        app: { getPath: name => name === "home" || name === "temp" ? root : path.join(root, "app.exe"), once() {} },
        getMainWindow: () => ({ webContents }), fs, path, yaml, childProcess: require("node:child_process")
    });
    assert.equal(await handler({ sender: webContents, senderFrame: mainFrame }, "edit", { home, language: "yaml", content: "original" }), "original :: edited by CLI");
    assert.equal(fs.readdirSync(root).some(name => name.startsWith("cfw-external-editor-")), false);
});
