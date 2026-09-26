"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { EventEmitter } = require("node:events");
const { homePage } = require("../fixtures/home-page");
const { registerGlobalShortcutIpc } = require("../../main/dist/electron/features/shortcuts/register-global-shortcut-ipc");
const { registerWindowControlIpc } = require("../../main/dist/electron/features/window/register-window-control-ipc");
const { registerMainWindowLifecycle } = require("../../main/dist/electron/features/window/register-main-window-lifecycle");
const { createShowMainWindow } = require("../../main/dist/electron/features/window/show-main-window");

test("Script mode shortcut is unregistered for Mihomo and restored for Clash", async () => {
    const calls = [];
    const electron = {
        ipcRenderer: {
            async invoke(channel, action, key) {
                calls.push([channel, action, key]);
                return true;
            },
            send() {}, on() {}
        },
        shell: {}
    };
    const page = homePage({ electron });
    const context = {
        settings: { proxyCore: "mihomo" },
        shortcuts: { "Control+Shift+S": () => {} },
        switchMode() { throw new Error("Mihomo must not bind Script mode"); },
        rebindShortcut: page.methods.rebindShortcut
    };
    await page.methods.rebindScriptModeShortcut.call(context, "Control+Shift+S", "Control+Shift+S");
    assert.deepEqual(calls, [["globalShortcut", "unregister", "Control+Shift+S"]]);
    assert.equal(context.shortcuts["Control+Shift+S"], undefined);

    context.settings.proxyCore = "clash";
    await page.methods.rebindScriptModeShortcut.call(context, "Control+Shift+S", "");
    assert.deepEqual(calls.slice(-2), [
        ["globalShortcut", "register", "Control+Shift+S"],
        ["globalShortcut", "isRegistered", "Control+Shift+S"]
    ]);
    assert.equal(typeof context.shortcuts["Control+Shift+S"], "function");
});

for (const platform of ["win32", "linux", "darwin"]) {
    for (const hasTray of [true, false]) {
        test(`Dashboard shortcut: ${platform}, tray=${hasTray}, registers, toggles and rebinds`, async () => {
            const handlers = new Map(), shortcuts = new Map();
            const ipcMain = { handle: (channel, callback) => handlers.set(channel, callback) };
            const ipcRenderer = { invoke: async (channel, ...args) => handlers.get(channel)(null, ...args) };
            const globalShortcut = {
                register(key, callback) { shortcuts.set(key, callback); return true; },
                unregister: key => shortcuts.delete(key),
                isRegistered: key => shortcuts.has(key),
                unregisterAll: () => shortcuts.clear()
            };
            let visible = false, focused = false, minimized = false, exited = false, closes = 0;
            const window = new EventEmitter();
            const renderer = { shortcuts: {} };
            Object.assign(window, {
                isVisible: () => visible, isFocused: () => focused, isMinimized: () => minimized,
                isMaximized: () => false, isFullScreen: () => false,
                blur() { focused = false; },
                hide() { visible = false; window.emit("hide"); },
                minimize() { minimized = true; focused = false; },
                show() { visible = true; focused = true; minimized = false; window.emit("show"); },
                restore() { window.show(); }, setVisibleOnAllWorkspaces() {},
                webContents: { send(channel, key) { if (channel === "shortcut-pressed") renderer.shortcuts[key](); } }
            });
            const app = {
                isQuiting: false, dock: { show() {}, hide() {} },
                exit() { exited = true; },
                quit() {
                    closes++;
                    let prevented = false;
                    window.emit("close", { preventDefault() { prevented = true; } });
                    if (!prevented) exited = true;
                }
            };
            registerMainWindowLifecycle({ mainWindow: window, app, globalShortcut, getTray: () => hasTray, platform });
            registerWindowControlIpc({ ipcMain, app, getMainWindow: () => window, showMainWindow: createShowMainWindow({ getMainWindow: () => window, platform, setTimeoutFn: fn => fn() }) });
            registerGlobalShortcutIpc({ ipcMain, globalShortcut, getMainWindow: () => window });
            const page = homePage({ electron: { ipcRenderer, shell: {} } });
            const bind = page.methods.rebindShortcut;
            let binding;
            renderer.rebindShortcut = (...args) => { binding = bind.apply(renderer, args); return binding; };
            const watch = page.watch["settings.shortcutShowHideDashboard"];
            watch.call(renderer, "Control+Shift+D", "");
            assert.equal(await binding, true);
            const press = () => shortcuts.get("Control+Shift+D")();
            press(); // The old implementation shows and immediately closes here.
            assert.equal(visible, true); assert.equal(focused, true); assert.equal(closes, 0);
            press();
            assert.equal(closes, 1); assert.equal(focused, false);
            assert.equal(hasTray ? !visible : minimized, true);
            press();
            assert.equal(visible, true); assert.equal(focused, true); assert.equal(minimized, false);
            assert.equal(closes, 1);
            focused = false;
            press(); // A visible background window is raised rather than hidden.
            assert.equal(focused, true); assert.equal(closes, 1);
            assert.equal(exited, false); assert.equal(shortcuts.size, 1);

            watch.call(renderer, "Control+Shift+F12", "Control+Shift+D");
            assert.equal(await binding, true);
            assert.equal(shortcuts.has("Control+Shift+D"), false);
            shortcuts.get("Control+Shift+F12")();
            assert.equal(closes, 2);
            watch.call(renderer, "", "Control+Shift+F12");
            await binding;
            assert.equal(shortcuts.size, 0);
        });
    }
}
