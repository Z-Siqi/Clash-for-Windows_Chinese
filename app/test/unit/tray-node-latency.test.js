"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createContextMenuBuilder } = require("../../main/dist/electron/features/tray/build-context-menu");
const { createTrayLifecycle } = require("../../main/dist/electron/features/tray/tray-lifecycle");

function deferred() {
    let resolve, reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}

function fixture(showIcons = true, names = ["Fast", "Slow"]) {
    const provider = deferred(), selected = [], updates = [];
    let providerReads = 0;
    const state = { isReady: true, isShowDelayIcon: showIcons, menuStyle: 1 };
    const build = createContextMenuBuilder({ state, path, staticRoot: "packaged", isLinux: () => false,
        localize: english => english, nativeImage: { createFromPath: iconPath => ({ resize: () => ({ iconPath }) }) },
        actions: { updateProxyIcons: items => updates.push(items), sendRenderer() {} },
        clashApi: {
            async getProxies() { return { data: { proxies: { Auto: { type: "Selector", all: names, now: names[0] } } } }; },
            getProxyProviders() { providerReads++; return provider.promise; },
            async selectProxy(group, node) { selected.push([group, node]); return { status: 204 }; }
        }
    });
    const choices = menu => menu.find(item => item.label === "Proxy Groups").submenu[0].submenu;
    return { state, build, provider, choices, selected, updates, providerReads: () => providerReads };
}

test("slow Provider health never blocks tray node choices or the selection request", async () => {
    const state = fixture();
    let menu;
    const building = state.build().then(result => { menu = result; });
    await new Promise(setImmediate);
    assert.ok(menu, "node choices must be ready while optional Provider health is still pending");
    await state.choices(menu)[1].click();
    assert.deepEqual(state.selected, [["Auto", "Slow"]]);
    assert.equal(state.choices(menu)[1].icon, null);
    state.provider.resolve({ data: { providers: { one: { proxies: [{ name: "Slow", alive: true }] } } } });
    await building;
    await new Promise(setImmediate);
    assert.match(state.choices(menu)[1].icon.iconPath, /online/);
    assert.equal(state.updates.at(-1)[1].id, state.choices(menu)[1].id);
});

test("hidden tray groups and disabled health icons avoid unnecessary Provider requests", async () => {
    for (const style of [1, 2]) {
        const state = fixture(false);
        state.state.menuStyle = style;
        await state.build();
        assert.equal(state.providerReads(), 0);
    }
});

test("large Provider lists are indexed once instead of scanned for every tray node", async () => {
    const names = Array.from({ length: 1000 }, (_unused, index) => `node-${index}`);
    const state = fixture(true, names);
    let lookups = 0;
    state.provider.resolve({ data: { providers: { many: { proxies: names.map(name => ({ get name() { lookups++; return name; }, alive: true })) } } } });
    const menu = await state.build();
    await new Promise(setImmediate);
    assert.equal(state.choices(menu).length, 1000);
    assert.equal(lookups, 1000);
});

test("failed Provider status does not remove selectable tray nodes, and proxy operations block stale menu clicks", async () => {
    const state = fixture();
    const menu = await state.build();
    state.provider.reject(Error("optional metadata unavailable"));
    await new Promise(setImmediate);
    assert.equal(state.choices(menu).length, 2);
    state.state.proxyBusy = true;
    await state.choices(menu)[1].click();
    assert.deepEqual(state.selected, []);
    const blocked = await state.build();
    assert.equal(state.choices(blocked)[1].enabled, false);
});

test("late tray icons update only the menu generation they belong to", async () => {
    const listeners = new Map(), tray = { setToolTip() {}, on: (name, action) => listeners.set(name, action), popUpContextMenu(menu) { this.menu = menu; } };
    let generation = 0;
    let lookups = 0;
    const lifecycle = createTrayLifecycle({ ipcMain: { handle() {} }, Tray: function() { return tray; },
        path, staticRoot: "packaged", platform: "win32", showMainWindow() {},
        nativeImage: { createFromPath: () => ({ resize() { return this; }, setTemplateImage() {} }) },
        buildContextMenu: async () => [{ id: `tray-proxy-${++generation}`, icon: null }],
        Menu: { buildFromTemplate: items => ({ items, getMenuItemById: id => { lookups++; return items.find(item => item.id === id); } }) }
    });
    lifecycle.create();
    listeners.get("right-click")(); await new Promise(setImmediate);
    const oldMenu = tray.menu;
    listeners.get("right-click")(); await new Promise(setImmediate);
    lifecycle.updateProxyIcons([{ id: "tray-proxy-1", icon: "late" }]);
    assert.equal(oldMenu.getMenuItemById("tray-proxy-1").icon, null);
    assert.equal(tray.menu.getMenuItemById("tray-proxy-2").icon, null);
    const before = lookups;
    lifecycle.updateProxyIcons([{ id: "tray-proxy-2", icon: "current" }]);
    assert.equal(lookups, before, "icon updates use the native menu index instead of rescanning its items");
    assert.equal(tray.menu.getMenuItemById("tray-proxy-2").icon, "current");
});

test("a slower old tray menu build cannot replace the most recent popup", async () => {
    const first = deferred(), second = deferred(), listeners = new Map();
    const tray = { setToolTip() {}, on: (name, callback) => listeners.set(name, callback), popUpContextMenu(menu) { this.menu = menu; } };
    let calls = 0;
    const lifecycle = createTrayLifecycle({ ipcMain: { handle() {} }, Tray: function() { return tray; }, path,
        staticRoot: "packaged", platform: "win32", showMainWindow() {},
        nativeImage: { createFromPath: () => ({ resize() { return this; }, setTemplateImage() {} }) },
        buildContextMenu: () => ++calls === 1 ? first.promise : second.promise,
        Menu: { buildFromTemplate: items => ({ items }) }
    });
    lifecycle.create();
    listeners.get("right-click")(); listeners.get("right-click")();
    second.resolve([{ label: "latest" }]); await new Promise(setImmediate);
    first.resolve([{ label: "old" }]); await new Promise(setImmediate);
    assert.equal(tray.menu.items[0].label, "latest");
});
