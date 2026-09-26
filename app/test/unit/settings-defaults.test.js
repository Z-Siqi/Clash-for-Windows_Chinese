"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const rendererPath = path.join(root, "app/main/dist/electron/renderer.js");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const { mergeSettings } = require(
    path.join(root, "app/main/dist/electron/features/settings/settings-defaults")
);
const { loadSettingsFromDisk } = require(
    path.join(root, "app/main/dist/electron/features/settings/load-settings")
);

const defaults = mergeSettings({});
assert.deepEqual(defaults, {
    showNewVersionIcon: true,
    hideAfterStartup: false,
    randomControllerPort: true,
    runTimeFormat: "hh : mm : ss",
    trayOrders: [["icon"], ["status", "traffic", "text"]],
    hideTrayIcon: false,
    connShowProcess: true,
    connProxyDisconnect: true,
    showTrayProxyDelayIndicator: true,
    checkForUpdates: true,
    disableLoadingAdsLink: true,
    allowRemoteProfileParsers: false,
    proxyCore: "mihomo"
});

const customTrayOrders = [["text"]];
const custom = mergeSettings({
    showNewVersionIcon: false,
    hideAfterStartup: true,
    randomControllerPort: false,
    runTimeFormat: "HH:mm:ss",
    trayOrders: customTrayOrders,
    hideTrayIcon: true,
    connShowProcess: false,
    connProxyDisconnect: false,
    showTrayProxyDelayIndicator: false,
    checkForUpdates: false,
    disableLoadingAdsLink: false,
    allowRemoteProfileParsers: true,
    preserved: "value"
});
assert.equal(custom.showNewVersionIcon, false);
assert.equal(custom.hideAfterStartup, true);
assert.equal(custom.randomControllerPort, false);
assert.equal(custom.runTimeFormat, "HH:mm:ss");
assert.equal(custom.trayOrders, customTrayOrders);
assert.equal(custom.preserved, "value");
assert.equal(custom.connProxyDisconnect, false);
assert.equal(custom.allowRemoteProfileParsers, true);

const defaultsAgain = mergeSettings({});
defaults.trayOrders[0].push("mutated");
assert.deepEqual(defaultsAgain.trayOrders, [["icon"], ["status", "traffic", "text"]]);

let profileLanguage;
const loaded = loadSettingsFromDisk({
    fs: { readFileSync: file => {
        assert.equal(file, path.join("C:\\clash", "cfw-settings.yaml"));
        return Buffer.from("language: 0");
    } },
    path,
    yaml: { parse: () => ({ language: 0, hideTrayIcon: true }) },
    clashPath: "C:\\clash",
    onProfileLanguage: language => { profileLanguage = language; }
});
assert.equal(profileLanguage, 0);
assert.equal(loaded.hideTrayIcon, true);
assert.equal(loaded.randomControllerPort, true);

const recovered = loadSettingsFromDisk({
    fs: { readFileSync: () => { throw new Error("missing"); } },
    path,
    yaml: { parse: () => { throw new Error("should not parse"); } },
    clashPath: "C:\\missing"
});
assert.deepEqual(recovered, mergeSettings({}));

const rendererSource = readRendererCompositionSource(root);
const settingsPageComponentsSource = fs.readFileSync(path.join(
    path.dirname(rendererPath), "features/settings/page-components.js"
), "utf8");
assert.match(
    rendererSource,
    /require\("\.\/settings-defaults"\)/
);
const mixinSource = fs.readFileSync(path.join(path.dirname(rendererPath), "entry/renderer/global-mixin.js"), "utf8");
assert.match(mixinSource, /require\("..\/..\/features\/settings\/load-settings"\)/);
assert.match(mixinSource, /const mergedSettings = loadSettingsFromDisk\(\{/);
assert.match(
    settingsPageComponentsSource,
    /viewModel\.\$slots\.default\?\.length/,
    "empty Settings sections must render without dereferencing a missing slot"
);
assert.equal(settingsPageComponentsSource.includes("return viewModel.$slots.default.length ?"), false);
const rendererEntrySource = fs.readFileSync(rendererPath, "utf8");
assert.equal(rendererEntrySource.includes("fs.readFileSync(configPath)"), false);
assert.equal(
    settingsPageComponentsSource.includes(
        "const showNewVersionIcon = settings.showNewVersionIcon !== false;"
    ),
    false,
    "renderer.js still owns extracted settings-default logic"
);

console.log("settings defaults smoke: PASS");
