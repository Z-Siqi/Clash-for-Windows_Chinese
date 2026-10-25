"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createTrayState } = require("../../main/dist/electron/features/tray/tray-state");
const { createTrayProxyProgress, proxyMenuEntries } = require("../../main/dist/electron/features/tray/proxy-operation-progress");

function fixture(sendError = false) {
    const state = { ...createTrayState(), isReady: true, tunModeChecked: true };
    const calls = [], timers = new Map();
    let progress;
    const actions = { requestProxyOperation: (...args) => progress.request(...args), getProxyProgressIcon: () => progress?.getIcon() };
    const entries = [
        ...proxyMenuEntries({ state, actions, operation: "tun", item: { id: "tun", label: "TUN", type: "checkbox", checked: true } }),
        ...proxyMenuEntries({ state, actions, operation: "mixin", item: { id: "mixin", label: "Mixin", type: "checkbox" } }),
        ...proxyMenuEntries({ state, actions, operation: "mode", item: { id: "mode-global", label: "Global", type: "radio" } })
    ];
    const node = { id: "tray-proxy-fixture-node", enabled: true, checked: true };
    const menu = { items: [...entries, { submenu: { items: [node] } }], getMenuItemById: id => entries.find(item => item.id === id) };
    progress = createTrayProxyProgress({ state, getMenus: () => [menu], refreshMenu() {},
        sendRenderer(...args) { calls.push(args); if (sendError) throw Error("renderer gone"); },
        nativeImage: { createFromBitmap: (pixels, size) => ({ pixels: [...pixels], size }) },
        repeat(fn) { timers.set(1, fn); return 1; }, cancel(id) { timers.delete(id); }
    });
    return { state, calls, timers, menu, progress, node };
}

test("tray reserves before IPC, rejects burst/stale clicks and ignores an old idle snapshot", () => {
    const h = fixture();
    h.menu.getMenuItemById("tun").click({ checked: false });
    assert.equal(h.calls.length, 1);
    const requestId = h.calls[0][2];
    assert.equal(h.state.proxyBusy, true);
    assert.equal(h.menu.getMenuItemById("tun").visible, false);
    assert.equal(h.menu.getMenuItemById("tun-pending").visible, true);
    for (let i = 0; i < 100; i++) {
        h.menu.getMenuItemById("tun").click({ checked: true });
        h.menu.getMenuItemById("mixin").click({ checked: true });
        assert.equal(h.progress.request("mode", "global"), false);
    }
    h.progress.update({ busy: false, operation: "", target: null });
    assert.equal(h.state.proxyBusy, true);
    assert.equal(h.calls.length, 1);
    h.progress.update({ busy: true, operation: "tun", target: false, requestId });
    assert.equal(h.menu.getMenuItemById("mixin").enabled, false);
    const firstIcon = h.menu.getMenuItemById("tun-pending").icon;
    h.timers.get(1)();
    assert.notDeepEqual(h.menu.getMenuItemById("tun-pending").icon.pixels, firstIcon.pixels);
    h.progress.update({ busy: false, operation: "", target: null, requestId });
    assert.equal(h.menu.getMenuItemById("tun").visible, true);
    assert.equal(h.menu.getMenuItemById("tun").checked, true, "failed disable retains the original checkmark");
    assert.equal(h.menu.getMenuItemById("tun-pending").visible, false);
    assert.equal(h.menu.getMenuItemById("mixin").enabled, true);
    assert.equal(h.timers.size, 0);
    h.progress.update({ busy: true, operation: "profile", target: null });
    assert.equal(h.node.enabled, false);
    assert.equal(h.node.checked, true);
    h.progress.update({ busy: false, operation: "", target: null });
    assert.equal(h.node.enabled, true);
});

test("tray routing-mode progress uses the selected mode's check column and clears after success", () => {
    const h = fixture();
    h.progress.update({ busy: true, operation: "mode", target: "global" });
    assert.equal(h.menu.getMenuItemById("mode-global").visible, false);
    assert.equal(h.menu.getMenuItemById("mode-global-pending").visible, true);
    h.state.menuMode = "global";
    h.progress.update({ busy: false, operation: "", target: null });
    assert.equal(h.menu.getMenuItemById("mode-global").checked, true);
    assert.equal(h.menu.getMenuItemById("mode-global").enabled, true);
});

test("a failed tray IPC send releases its reservation and timer", () => {
    const h = fixture(true);
    assert.equal(h.progress.request("mixin", true), false);
    assert.equal(h.state.proxyBusy, false);
    assert.equal(h.timers.size, 0);
    assert.equal(h.menu.getMenuItemById("mixin").enabled, true);
});
