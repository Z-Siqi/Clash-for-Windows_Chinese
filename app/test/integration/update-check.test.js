"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { homePage } = require("../fixtures/home-page");
const { createUpdateFeed, assetName } = require("../../main/dist/electron/core/release/release-info");

test("production update check recognizes the published Windows installer and compares four-part versions", async () => {
    const feed = createUpdateFeed({ version: "0.2039.4.1", displayVersion: "Opt-4.1" });
    const page = homePage({
        runtimeProcess: { platform: "win32", arch: "x64" },
        electron: { ipcRenderer: { invoke: async () => "0.20.39.9" }, shell: {} },
        publicContent: { getUpdate: async () => ({ status: 200, data: feed }) }
    });
    const vm = { portableMode: false };
    await page.methods.checkForUpdate.call(vm);
    assert.equal(vm.newVersionInfo.url, feed.assets[0].browser_download_url);
    assert.equal(feed.assets[0].name, assetName("win-x64", feed.tag_name, false, feed.display_version));
    assert.equal(vm.newVersionInfo.version, "0.2039.4.1");
    assert.equal(vm.newVersionInfo.displayVersion, "Opt-4.1");
});

test("a larger display label alone does not trigger an update", async () => {
    const feed = createUpdateFeed({ displayVersion: "Opt-999" });
    const page = homePage({
        runtimeProcess: { platform: "win32", arch: "x64" },
        electron: { ipcRenderer: { invoke: async () => feed.tag_name }, shell: {} },
        publicContent: { getUpdate: async () => ({ status: 200, data: feed }) }
    });
    const vm = { portableMode: false };
    await page.methods.checkForUpdate.call(vm);
    assert.equal(vm.newVersionInfo, undefined);
});
