"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createShortcutBindings } = require("../../main/dist/electron/features/shortcuts/shortcut-bindings");
const { homePage } = require("../fixtures/home-page");
const { mergeSettings } = require("../../main/dist/electron/features/settings/settings-defaults");

function native() {
    const keys = new Map();
    return { keys, register(key, callback) {
        if (key.includes("++")) throw Error("Invalid accelerator");
        if (keys.has(key)) return false;
        keys.set(key, callback); return true;
    }, unregister: key => keys.delete(key), isRegistered: key => keys.has(key) };
}

test("shortcut ownership preserves old bindings on conflict or invalid capture and survives renderer reload", () => {
    const globalShortcut = native(), pressed = [];
    const bindings = createShortcutBindings({ globalShortcut, onPressed: action => pressed.push(action) });
    assert.equal(bindings.bind("shortcutTun", "Control+F9").success, true);
    assert.equal(bindings.bind("shortcutMixin", "Control+F10").success, true);
    assert.deepEqual(bindings.bind("shortcutMixin", "Control+F9"), { success: false, shortcut: "Control+F10" });
    assert.deepEqual(bindings.bind("shortcutTun", "Control++"), { success: false, shortcut: "Control+F9" });
    assert.equal(bindings.bind("shortcutTun", "Control+F9").success, true, "a reloaded renderer reuses its native binding");
    globalShortcut.keys.get("Control+F9")();
    assert.deepEqual(pressed, ["shortcutTun"]);
    bindings.capture(true);
    globalShortcut.keys.get("Control+F9")();
    assert.equal(pressed.length, 1, "recording must not trigger the old action");
    bindings.capture(false);
    bindings.bind("shortcutTun", "");
    assert.equal(globalShortcut.keys.has("Control+F10"), true);
    globalShortcut.keys.get("Control+F10")();
    assert.equal(pressed.at(-1), "shortcutMixin");
    assert.equal(bindings.bind("shortcutMixin", "Control+Plus").success, true);
    assert.equal(globalShortcut.keys.has("Control+F10"), false);
});

test("a rejected shortcut edit restores the saved field and leaves its old callback usable", async () => {
    const globalShortcut = native(), messages = [], pressed = [];
    const bindings = createShortcutBindings({ globalShortcut, onPressed: action => vm.shortcuts[action]() });
    const page = homePage({ electron: { ipcRenderer: { invoke: async (_channel, operation, ...args) => bindings[operation](...args) } },
        showMessageBox: async value => messages.push(value) });
    const vm = { shortcuts: {}, settings: {} };
    await page.methods.rebindShortcut.call(vm, "Control+F9", "", () => pressed.push("tun"), "shortcutTun");
    await page.methods.rebindShortcut.call(vm, "Control+F10", "", () => pressed.push("mixin"), "shortcutMixin");
    vm.settings.shortcutMixin = "Control+F9";
    assert.equal(await page.methods.rebindShortcut.call(vm, "Control+F9", "Control+F10", () => pressed.push("wrong"), "shortcutMixin"), false);
    assert.equal(vm.settings.shortcutMixin, "Control+F10");
    assert.equal(messages.length, 1);
    globalShortcut.keys.get("Control+F10")();
    assert.deepEqual(pressed, ["mixin"]);
});

test("core switches retain a dormant Script shortcut when another action now owns its key", async () => {
    const globalShortcut = native();
    const bindings = createShortcutBindings({ globalShortcut, onPressed() {} });
    const page = homePage({ electron: { ipcRenderer: { invoke: async (_channel, operation, ...args) => bindings[operation](...args), send() {} } }, showMessageBox: async () => {} });
    const vm = { ...page.methods, shortcuts: {}, settings: { proxyCore: "clash", shortcutScriptMode: "Control+F9" }, mode: "rule" };
    await vm.rebindScriptModeShortcut(vm.settings.shortcutScriptMode);
    vm.settings.proxyCore = "mihomo";
    page.watch["settings.proxyCore"].call(vm, "mihomo");
    await new Promise(resolve => setImmediate(resolve));
    await vm.rebindShortcut("Control+F9", "", () => {}, "shortcutMixin");
    vm.settings.proxyCore = "clash";
    page.watch["settings.proxyCore"].call(vm, "clash");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(vm.settings.shortcutScriptMode, "Control+F9");
    assert.equal(globalShortcut.keys.has("Control+F9"), true);
});

test("a first rejected shortcut recording restores the unset preference", async () => {
    const globalShortcut = native(), bindings = createShortcutBindings({ globalShortcut, onPressed() {} });
    const page = homePage({ electron: { ipcRenderer: { invoke: async (_channel, operation, ...args) => bindings[operation](...args) } }, showMessageBox: async () => {} });
    const vm = { shortcuts: {}, settings: mergeSettings({ shortcutTun: "Control+F9" }) };
    await page.methods.rebindShortcut.call(vm, vm.settings.shortcutTun, undefined, () => {}, "shortcutTun");
    const previous = vm.settings.shortcutMixin;
    for (const value of ["Control+F9", "Control++"]) {
        vm.settings.shortcutMixin = value;
        assert.equal(await page.methods.rebindShortcut.call(vm, value, previous, () => {}, "shortcutMixin"), false);
        assert.equal(vm.settings.shortcutMixin, "");
        assert.equal(vm.shortcuts.shortcutMixin, undefined);
    }
});
