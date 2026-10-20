"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { networkModeDiagnostics } = require("../../main/dist/electron/features/profiles/network-mode-diagnostics");
const { buildTunConfig } = require("../../main/dist/electron/features/tun/build-tun-config");

test("diagnostics distinguish requested TUN from the accepted Mixin/profile configuration", () => {
    const tunConfig = buildTunConfig({}, "win32");
    const original = JSON.stringify(tunConfig);
    assert.deepEqual(networkModeDiagnostics({ config: tunConfig, tunRequested: true, tunConfig }), []);
    assert.deepEqual(networkModeDiagnostics({ config: { tun: { enable: false } }, tunRequested: true, tunConfig }), ["networkTunOverridden"]);
    assert.deepEqual(networkModeDiagnostics({ config: tunConfig, tunRequested: false }), ["networkTunFromProfile"]);
    const partial = { tun: { enable: true }, dns: { enable: false } };
    assert.deepEqual(networkModeDiagnostics({ config: partial, tunRequested: true, tunConfig }), [
        "networkTunOptionsOverridden", "networkDnsOverridden", "networkTunDnsDisabled"
    ]);
    assert.equal(JSON.stringify(tunConfig), original);
    const manual = buildTunConfig({ isAutoDetectInterface: false, interfaceName: "expected-adapter" }, "win32");
    assert.deepEqual(networkModeDiagnostics({ config: { ...manual, "interface-name": "mixin-adapter" }, tunRequested: true, tunConfig: manual }), ["networkTunOptionsOverridden"]);
});

test("coexistence hints describe bypass semantics and legacy DNS/TAP without changing policy", () => {
    assert.deepEqual(networkModeDiagnostics({ config: { dns: { enable: true, listen: ":53" } }, tapActive: true, systemProxyOn: true }), [
        "networkLegacyTapActive", "networkBypassHint", "networkDnsListen53"
    ]);
    assert.deepEqual(networkModeDiagnostics({ config: { dns: { enable: true, listen: "127.0.0.1:53" } } }), []);
    const tunConfig = buildTunConfig({}, "win32");
    const reordered = { tun: Object.fromEntries(Object.entries(tunConfig.tun).reverse()), dns: { ...tunConfig.dns } };
    assert.deepEqual(networkModeDiagnostics({ config: reordered, tunRequested: true, tunConfig }), []);
});
