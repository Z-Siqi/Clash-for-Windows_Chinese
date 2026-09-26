"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("renderer loads Vue from the declared node_modules dependency", () => {
    const root = path.resolve(__dirname, "../../..");
    const renderer = fs.readFileSync(path.join(root, "app/main/dist/electron/entry/renderer/start-renderer.js"), "utf8");
    const pkg = require(path.join(root, "app/main/package.json"));
    assert.match(renderer, /const Vue = require\("vue\/dist\/vue\.runtime\.common\.prod\.js"\)/);
    assert.match(renderer, /const VERSION = "Opt-4"/);
    assert.equal(renderer.includes('tn.version = "2.7.14"'), false);
    assert.equal(renderer.includes("function qa(e)"), false);
    assert.equal(typeof pkg.dependencies.vue, "string");
});
