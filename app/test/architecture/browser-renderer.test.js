"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

test("the production browser renderer manifest excludes native transports and capabilities", () => {
    const root = path.resolve(__dirname, "../../..");
    const output = path.join(root, "app/build/generated/renderer");
    const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    const content = fs.readFileSync(path.join(output, "renderer.js"));
    assert.equal(crypto.createHash("sha256").update(content).digest("hex"), manifest.sha256);
    assert.equal(manifest.builder, "esbuild@0.28.2");
    assert.ok(manifest.inputs.some(value => value.endsWith("dist/electron/renderer.js")));
    for (const file of manifest.inputs) assert.doesNotMatch(file, /node_modules\/(got|ws|electron-log|@vscode\/sudo-prompt)\//);
    const preload = fs.readFileSync(path.join(root, "app/main/dist/electron/preload.js"), "utf8");
    assert.deepEqual(Array.from(preload.matchAll(/require\("([^"]+)"\)/g), match => match[1]), ["electron"]);
    assert.doesNotMatch(preload, /exposeInMainWorld/);
});
