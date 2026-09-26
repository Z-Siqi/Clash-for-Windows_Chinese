"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const electronRoot = path.join(root, "app/main/dist/electron");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const {
    normalizeCoreType,
    resolveCoreBinaryPath,
    getCoreDisplayName
} = require(path.join(electronRoot, "core/clash-core/core-selection"));
const { buildProxyConfig } = require(path.join(
    electronRoot,
    "features/profiles/proxy-editor-config"
));
const { mergeSettings } = require(path.join(
    electronRoot,
    "features/settings/settings-defaults"
));

assert.equal(normalizeCoreType("mihomo"), "mihomo");
assert.equal(normalizeCoreType("invalid"), "clash");
assert.equal(mergeSettings({}).proxyCore, "mihomo");
assert.equal(mergeSettings({ proxyCore: "mihomo" }).proxyCore, "mihomo");
assert.equal(mergeSettings({ proxyCore: "clash" }).proxyCore, "clash");
assert.equal(getCoreDisplayName("mihomo"), "Mihomo");
assert.equal(
    resolveCoreBinaryPath({ path, filesPath: "C:\\files", platform: "win32", arch: "x64", coreType: "clash" }),
    path.join("C:\\files", "win", "x64", "clash-win64.exe")
);
assert.equal(
    resolveCoreBinaryPath({ path, filesPath: "/files", platform: "linux", arch: "arm64", coreType: "mihomo" }),
    path.join("/files", "linux", "arm64", "mihomo-linux-arm64")
);
assert.throws(() => resolveCoreBinaryPath({ path, filesPath: "/files", platform: "aix", arch: "x64" }));

const anytls = buildProxyConfig({
    original: {
        _index: 2,
        type: "anytls",
        "client-metadata": "preserved",
        "shadow-tls-opts": { version: 3 }
    },
    proxyType: "anytls",
    proxyName: "AnyTLS node",
    proxyServer: "example.com",
    proxyPort: "443",
    proxyPassword: "secret",
    proxyClientFingerprint: "chrome",
    proxyUdp: true,
    proxySni: "sni.example.com",
    proxyAlpn: "h2, http/1.1",
    proxyIdleSessionCheckInterval: "30",
    proxyIdleSessionTimeout: "45",
    proxyMinIdleSession: "1",
    proxySkipCertVerify: true
});
assert.deepEqual(anytls, {
    type: "anytls",
    "client-metadata": "preserved",
    "shadow-tls-opts": { version: 3 },
    name: "AnyTLS node",
    server: "example.com",
    port: 443,
    password: "secret",
    udp: true,
    "client-fingerprint": "chrome",
    sni: "sni.example.com",
    alpn: ["h2", "http/1.1"],
    "idle-session-check-interval": 30,
    "idle-session-timeout": 45,
    "min-idle-session": 1,
    "skip-cert-verify": true
});

const renderer = readRendererCompositionSource(root);
const profileEditor = fs.readFileSync(path.join(
    electronRoot, "features/profiles/profile-editor-page.js"
), "utf8");
const settingsPageOptions = fs.readFileSync(path.join(
    electronRoot, "features/settings/page-options.js"
), "utf8");
assert.match(renderer, /core\/clash-core\/core-selection/);
assert.match(renderer, /features\/profiles\/proxy-editor-config/);
assert.match(renderer, /features\/profiles\/profile-editor-page/);
assert.match(settingsPageOptions, /proxyCore/);
assert.match(profileEditor, /"anytls"/);
console.log("core selection and AnyTLS smoke: PASS");
