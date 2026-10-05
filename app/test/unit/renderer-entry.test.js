"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { displayVersion } = require("../../main/dist/electron/core/release/release-info");

test("renderer entry loads without a global VERSION and exports the configured release revision", () => {
    const filename = path.resolve(__dirname, "../../main/dist/electron/entry/renderer/start-renderer.js");
    const rendererModule = { exports: {} };
    // Only module evaluation is under test; Vue mounting belongs to the real Electron smoke.
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
        module: rendererModule,
        require(request) {
            return request === "../../core/release/release-info" ? { displayVersion } : {};
        }
    }, { filename });
    assert.equal(rendererModule.exports.VERSION, displayVersion());
    assert.equal(typeof rendererModule.exports.startRenderer, "function");
});
