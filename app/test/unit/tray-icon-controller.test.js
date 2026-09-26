"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    createTrayIconController
} = require("../../main/dist/electron/features/tray/tray-icon-controller");

test("tray icon controller loads fresh images, settles updates, and restores the latest icon", () => {
    const loaded = [], applied = [], timers = [];
    const controller = createTrayIconController({
        nativeImage: { createFromPath(path) { loaded.push(path); return { path, isEmpty: () => false }; } },
        platform: "win32",
        setTimeoutFn(callback, delay) { timers.push({ callback, delay }); return timers.length; },
        clearTimeoutFn() {}
    });
    controller.setTray({ setImage: image => applied.push(image.path) });
    assert.equal(controller.update("rule.ico"), true);
    assert.equal(controller.update("global.ico"), true);
    assert.equal(controller.getLatestPath(), "global.ico");
    assert.equal(timers.at(-1).delay, 250);
    timers.at(-1).callback();
    assert.equal(applied.at(-1), "global.ico");
    controller.setTray({ setImage: image => applied.push(`restored:${image.path}`) });
    assert.equal(applied.at(-1), "restored:global.ico");
    assert.ok(loaded.filter(path => path === "global.ico").length >= 3);
});

test("tray icon controller retries a transient Electron tray failure", () => {
    const timers = [];
    let attempts = 0;
    const controller = createTrayIconController({
        nativeImage: { createFromPath: path => ({ path, isEmpty: () => false }) },
        platform: "win32",
        setTimeoutFn(callback) { timers.push(callback); return timers.length; },
        clearTimeoutFn() {}
    });
    controller.setTray({ setImage() { attempts += 1; if (attempts === 1) throw new Error("stale tray handle"); } });
    assert.equal(controller.update("direct.ico"), false);
    timers.at(-1)();
    assert.ok(attempts >= 2);
});
