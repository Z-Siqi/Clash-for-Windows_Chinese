"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { registerApplicationIpc } = require("../../main/dist/electron/features/application/register-application-ipc");

test("application IPC rejects subframes and strips executable overrides from login settings", () => {
    const handlers = {};
    const mainFrame = {};
    const webContents = { mainFrame };
    const settings = [];
    registerApplicationIpc({
        ipcMain: { handle(channel, callback) { handlers[channel] = callback; }, on(channel, callback) { handlers[channel] = callback; } },
        getMainWindow: () => ({ webContents }), platform: "win32", app: { setLoginItemSettings: value => settings.push(value), quit() { throw new Error("Unauthorized quit"); } }
    });
    const event = { sender: webContents, senderFrame: mainFrame };
    assert.throws(() => handlers.app({ ...event, senderFrame: {} }, "getVersion"), /sender/);
    assert.throws(() => handlers["cleanup-done"]({ ...event, senderFrame: {} }), /sender/);
    assert.throws(() => handlers.app(event, "setLoginItemSettings", { openAtLogin: "true" }), /login/);
    handlers.app(event, "setLoginItemSettings", { openAtLogin: true, path: "untrusted.exe", args: ["untrusted"] });
    assert.deepEqual(settings, [{ openAtLogin: true }]);
    assert.throws(() => handlers.app(event, "exit", "0 & injected"), /code/);
});
