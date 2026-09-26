"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const electronRoot = path.resolve(__dirname, "../../main/dist/electron");

function assertRendererComposition(factoryName, legacyOwners = []) {
    const entry = fs.readFileSync(path.join(electronRoot, "renderer.js"), "utf8");
    const pages = fs.readFileSync(path.join(electronRoot, "entry/renderer/create-pages.js"), "utf8");
    assert.match(entry, /require\("\.\/entry\/renderer\/start-renderer"\)/);
    assert.equal(pages.includes(factoryName), true, `missing ${factoryName} composition`);
    for (const owner of legacyOwners) assert.equal(entry.includes(owner), false, owner);
}

module.exports = { assertRendererComposition };
