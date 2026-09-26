"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { registerWindowControlIpc } = require("../../main/dist/electron/features/window/register-window-control-ipc");

for (const [name, visible, focused, expected] of [
    ["hidden", false, false, "show"],
    ["visible in background", true, false, "show"],
    ["visible and focused", true, true, "close"],
    ["hidden with stale focus", false, true, "show"]
]) {
    test(`dashboard toggle from ${name} performs only ${expected}`, () => {
        let handler;
        const calls = [];
        registerWindowControlIpc({
            ipcMain: { handle(channel, callback) { assert.equal(channel, "window-control"); handler = callback; } },
            app: { quit: () => calls.push("close") },
            getMainWindow: () => ({ isVisible: () => visible, isFocused: () => focused }),
            showMainWindow: () => calls.push("show")
        });
        handler(null, "show-or-hide");
        assert.deepEqual(calls, [expected]);
    });
}
