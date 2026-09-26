"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createPreloadLoader } = require("../../main/dist/electron/entry/renderer/preload-loader");

test("isolated preload loader installs runtime paths and loads Monaco before the renderer", () => {
    const globalObject = {};
    const loaded = [];
    let domReady;
    const dirname = path.resolve("C:/packaged/electron");
    const staticDirectory = path.resolve("C:/packaged/resources/static");
    const documentObject = {
        readyState: "loading",
        addEventListener(event, listener, options) {
            assert.equal(event, "DOMContentLoaded");
            assert.deepEqual(options, { once: true });
            domReady = listener;
        }
    };

    const loader = createPreloadLoader({
        globalObject,
        documentObject,
        dirname,
        staticDirectory,
        path,
        pathToFileURL,
        loadModule: file => loaded.push(file),
        onError: error => { throw error; }
    });

    assert.deepEqual(loaded, []);
    domReady();
    assert.deepEqual(loaded, [
        path.join(dirname, "generated", "monaco", "monaco.js"),
        path.join(dirname, "renderer.js")
    ]);
    assert.equal(globalObject.__static, staticDirectory.replace(/\\/g, "\\\\"));
    assert.equal(globalObject.__CFW_MONACO_ASSET_BASE__, pathToFileURL(path.join(dirname, "generated", "monaco") + path.sep).href);
    assert.equal(globalObject.__CFW_RENDERER_ASSET_BASE__, pathToFileURL(dirname + path.sep).href);
    assert.equal(typeof globalObject.customElements.get, "function");
    assert.equal(typeof globalObject.customElements.define, "function");
    assert.equal(Object.getOwnPropertyDescriptor(globalObject, "__static").writable, false);

    loader.start();
    assert.equal(loaded.length, 2, "renderer loader must be idempotent");
});

test("isolated preload loader starts immediately after DOM readiness", () => {
    const loaded = [];
    createPreloadLoader({
        globalObject: {},
        documentObject: { readyState: "complete" },
        dirname: path.resolve("/electron"),
        path,
        pathToFileURL,
        loadModule: file => loaded.push(path.basename(file)),
        onError: error => { throw error; }
    });
    assert.deepEqual(loaded, ["monaco.js", "renderer.js"]);
});
