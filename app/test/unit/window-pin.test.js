"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { supportsWindowPin } = require("../../main/dist/electron/features/window/pin-policy");
const { registerWindowIpc } = require("../../main/dist/electron/features/window/register-window-ipc");
const { homePage } = require("../fixtures/home-page");

test("pin capability distinguishes native Wayland from X11 and forced Xwayland", () => {
    const wayland = { XDG_SESSION_TYPE: "wayland", WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":0" };
    assert.equal(supportsWindowPin({ platform: "linux", ozonePlatform: "wayland", env: { DISPLAY: ":0" } }), false);
    assert.equal(supportsWindowPin({ platform: "linux", ozonePlatform: "auto", env: wayland }), false);
    assert.equal(supportsWindowPin({ platform: "linux", env: wayland }), false);
    assert.equal(supportsWindowPin({ platform: "linux", ozonePlatform: "x11", env: wayland }), true);
    assert.equal(supportsWindowPin({ platform: "linux", env: { XDG_SESSION_TYPE: "x11", DISPLAY: ":0" } }), true);
    assert.equal(supportsWindowPin({ platform: "linux", env: {} }), false);
    for (const platform of ["win32", "darwin"]) assert.equal(supportsWindowPin({ platform, env: wayland }), true);
});

function windowHandler(ozonePlatform, mainWindow) {
    let handler;
    registerWindowIpc({ ipcMain: { handle: (channel, callback) => { if (channel === "window") handler = callback; } },
        app: { commandLine: { getSwitchValue: () => ozonePlatform } }, platform: "linux", env: {}, getMainWindow: () => mainWindow });
    return (...args) => handler({}, ...args);
}

test("native Wayland neither queries nor changes unsupported pin state", () => {
    const invoke = windowHandler("wayland", {
        isAlwaysOnTop() { assert.fail("unsupported query"); }, setAlwaysOnTop() { assert.fail("unsupported setter"); }
    });
    assert.deepEqual(invoke("getPinState"), { supported: false, pinned: false });
    assert.equal(invoke("setAlwaysOnTop", true), false);
});

test("X11 pin IPC reports the actual state and rejects invalid arguments", () => {
    let pinned = false;
    const invoke = windowHandler("x11", { isAlwaysOnTop: () => pinned, setAlwaysOnTop: value => { pinned = value; } });
    assert.deepEqual(invoke("getPinState"), { supported: true, pinned: false });
    assert.equal(invoke("setAlwaysOnTop", true), true);
    assert.equal(invoke("setAlwaysOnTop", false), false);
    assert.throws(() => invoke("setAlwaysOnTop", "true"), /Invalid window pin/);
    assert.throws(() => invoke("setAlwaysOnTop", true, "screen-saver"), /Invalid window pin/);
});

function statusBar(invoke, saved = true) {
    const writes = [], calls = [];
    const component = homePage({ keys: { IS_PIN_ENABLED: "pin" }, cache: { get: () => saved, put: (...args) => writes.push(args) },
        electron: { ipcRenderer: { on() {}, invoke: async (...args) => { calls.push(args); return invoke(...args); } } } }).components.StatusBar;
    return { component, model: { ...component.data(), ...component.methods }, calls, writes };
}

test("Wayland hides the pin and does not restore or overwrite a cached X11 preference", async () => {
    const fixture = statusBar((_channel, operation) => operation === "getPinState" ? { supported: false, pinned: false } : false);
    await fixture.component.mounted.call(fixture.model);
    assert.equal(fixture.model.pinSupported, false);
    assert.equal(fixture.model.isPinned, false);
    await fixture.model.pinApp();
    assert.equal(fixture.calls.some(call => call[1] === "setAlwaysOnTop"), false);
    assert.deepEqual(fixture.writes, []);
});

test("X11 restores its preference, toggles pin and persists only confirmed native state", async () => {
    const fixture = statusBar((_channel, operation, value) => operation === "getPinState" ? { supported: true, pinned: false } : value);
    await fixture.component.mounted.call(fixture.model);
    assert.equal(fixture.model.isPinned, true);
    await fixture.model.pinApp();
    assert.equal(fixture.model.isPinned, false);
    assert.deepEqual(fixture.writes, [["pin", false]]);
});

test("a refused native pin never lights the button or saves true", async () => {
    const fixture = statusBar(() => false);
    fixture.model.pinSupported = true;
    await fixture.model.pinApp();
    assert.equal(fixture.model.isPinned, false);
    assert.deepEqual(fixture.writes, [["pin", false]]);
});

test("pending and failed pin requests preserve confirmed state and release the toggle", async () => {
    let release;
    const fixture = statusBar(() => new Promise(resolve => { release = resolve; }));
    fixture.model.pinSupported = true;
    const pending = fixture.model.pinApp();
    await fixture.model.pinApp();
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.model.isPinned, false);
    release(true);
    await pending;
    assert.equal(fixture.model.isPinned, true);
    assert.equal(fixture.model.pinPending, false);
    const failed = statusBar(() => { throw Error("window closing"); });
    failed.model.pinSupported = true;
    await failed.model.pinApp();
    assert.equal(failed.model.pinPending, false);
    assert.deepEqual(failed.writes, []);
});

test("the Linux status bar omits only pin when unsupported", () => {
    const fixture = statusBar(() => false);
    const model = { ...fixture.model, isLinux: true, isWindows: false, theme: "light", percent: 0,
        _v: text => ({ text }), _s: String, _e: () => null };
    model._self = { _c: (tag, data, children) => ({ tag, data, children }) };
    const controls = () => fixture.component.render.call(model).children.filter(node => node?.data?.on?.click);
    assert.equal(controls().some(node => node.data.on.click === model.pinApp), false);
    assert.equal(controls().some(node => node.data.on.click === model.miniApp), true);
    model.pinSupported = true;
    assert.equal(controls().some(node => node.data.on.click === model.pinApp), true);
});
