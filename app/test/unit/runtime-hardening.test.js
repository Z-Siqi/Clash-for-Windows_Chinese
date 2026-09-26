"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fixShellPath = require("../../main/dist/electron/features/application/fix-shell-path");
const { v4 } = require("../../main/dist/electron/core/crypto/random-uuid");

test("runtime hardening keeps non-macOS PATH unchanged and uses the built-in UUID generator", () => {
    const before = process.env.PATH;
    fixShellPath("win32");
    assert.equal(process.env.PATH, before);
    assert.match(v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
