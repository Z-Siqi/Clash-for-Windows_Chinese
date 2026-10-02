"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { EventEmitter } = require("node:events");
const yaml = require("../../main/node_modules/yaml");
const { registerUserProcessIpc } = require("../../main/dist/electron/features/scripts/register-user-process-ipc");

test("user process IPC starts only saved commands and shuts down only its owned handles", async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-process-ipc-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const home = path.join(root, ".config", "clash");
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, "cfw-settings.yaml"), yaml.stringify({ childProcessText: yaml.stringify({ processes: [{ command: "saved-tool", args: ["saved-arg"], options: {} }] }) }));
    const mainFrame = {};
    const webContents = { mainFrame };
    let handler; let quit; let kills = 0; let spawns = 0;
    registerUserProcessIpc({
        ipcMain: { handle(_channel, callback) { handler = callback; } },
        app: { getPath: name => name === "home" ? root : path.join(root, "app.exe"), once(_event, callback) { quit = callback; } },
        getMainWindow: () => ({ webContents }), fs, path, yaml,
        childProcess: { spawn(command, args, options) {
            spawns++;
            assert.equal(command, "saved-tool"); assert.deepEqual(args, ["saved-arg"]); assert.equal(options.windowsHide, true);
            return Object.assign(new EventEmitter(), { kill() { kills++; } });
        } }
    });
    const event = { sender: webContents, senderFrame: mainFrame };
    assert.throws(() => handler({ ...event, senderFrame: {} }, home), /sender/);
    assert.throws(() => handler(event, { home, command: "injected" }), /home/);
    assert.equal(handler(event, home, { command: "injected" }), 1);
    assert.equal(handler(event, home), 1);
    assert.equal(spawns, 1);
    quit(); assert.equal(kills, 1);
});
