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
    const worker = fs.readFileSync(path.join(output, "connections-worker.js"));
    assert.equal(crypto.createHash("sha256").update(worker).digest("hex"), manifest.connectionsWorkerSha256);
    assert.ok(manifest.inputs.some(value => value.endsWith("dist/electron/renderer.js")));
    // Moment's dynamic locale requires are unavailable in the sandboxed bundle.
    assert.ok(manifest.inputs.some(value => value.endsWith("moment/locale/zh-cn.js")), "Chinese time locale must be bundled explicitly");
    for (const file of manifest.inputs) assert.doesNotMatch(file, /node_modules\/(got|ws|electron-log|@vscode\/sudo-prompt)\//);
    // Vue 2's template-parser advisory does not apply to this runtime-only build.
    assert.ok(manifest.inputs.some(file => file.endsWith("vue/dist/vue.runtime.common.prod.js")));
    for (const file of manifest.inputs) {
        assert.doesNotMatch(file, /node_modules\/(?:@vue\/compiler-sfc|vue-template-compiler|source-map-js)\//);
        assert.doesNotMatch(file, /vue\/dist\/vue\.common(?:\.prod)?\.js$/);
    }
    const preload = fs.readFileSync(path.join(root, "app/main/dist/electron/preload.js"), "utf8");
    assert.deepEqual(Array.from(preload.matchAll(/require\("([^"]+)"\)/g), match => match[1]), ["electron"]);
    assert.doesNotMatch(preload, /exposeInMainWorld/);
});
