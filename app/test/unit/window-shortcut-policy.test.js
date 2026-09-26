"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { shouldCloseWindowForShortcut } = require("../../main/dist/electron/features/home/window-shortcut-policy");

test("window shortcuts close the dashboard only when no active overlay owns the event", () => {
    assert.equal(shouldCloseWindowForShortcut({ target: { closest: selector => selector === ".no-esc" ? {} : null } }), false);
    assert.equal(shouldCloseWindowForShortcut({ target: { closest: () => null } }), true);
    assert.equal(shouldCloseWindowForShortcut({ target: { className: { baseVal: "icon" } } }), true);
    assert.equal(shouldCloseWindowForShortcut({}), true);
});
