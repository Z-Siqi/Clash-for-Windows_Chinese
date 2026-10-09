"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { bindMenuShortcuts, shouldNavigateForShortcut } = require("../../main/dist/electron/features/home/menu-shortcuts");

test("menu digit shortcuts yield to Monaco EditContext, text controls, overlays and composition", () => {
    for (const owner of [".monaco-editor", ".no-esc", "input", "textarea", "select", '[role="textbox"]']) {
        const event = { target: { closest: selector => selector.includes(owner) ? {} : null } };
        assert.equal(shouldNavigateForShortcut(event), false, owner);
    }
    assert.equal(shouldNavigateForShortcut({ target: { isContentEditable: true } }), false);
    assert.equal(shouldNavigateForShortcut({ defaultPrevented: true }), false);
    assert.equal(shouldNavigateForShortcut({ isComposing: true }), false);
    assert.equal(shouldNavigateForShortcut({ target: { closest: () => null } }), true);
    assert.equal(shouldNavigateForShortcut({ target: { className: { baseVal: "icon" } } }), true);
});

test("bound digit shortcuts leave editing events untouched and use the current menu order outside editors", () => {
    const handlers = new Map(), navigated = [];
    let clicks = 0, items = [{ path: "/home/setting" }, { path: "/home/server" }];
    bindMenuShortcuts({ mousetrap: { bind: (key, handler) => handlers.set(key, handler) },
        getMenuItems: () => items, navigate: path => navigated.push(path), onNavigate: () => clicks++ });
    assert.equal(handlers.size, 9);
    const typing = { target: { closest: () => ({}) }, preventDefault() { assert.fail("editing must not be prevented"); } };
    assert.equal(handlers.get("1")(typing), undefined);
    assert.equal(clicks, 0);
    assert.deepEqual(navigated, []);
    const dashboard = { target: { closest: () => null } };
    assert.equal(handlers.get("1")(dashboard), false);
    items = [...items].reverse();
    assert.equal(handlers.get("1")(dashboard), false);
    assert.equal(handlers.get("9")(dashboard), undefined);
    assert.equal(clicks, 2);
    assert.deepEqual(navigated, ["/home/setting", "/home/server"]);
});
