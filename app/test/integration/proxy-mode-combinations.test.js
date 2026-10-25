"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const { refreshProfile } = require("../../main/dist/electron/entry/renderer/refresh-profile");
const { createRendererCapabilities } = require("../../main/dist/electron/entry/renderer/capabilities");
const { DEFAULT_MIXIN } = require("../../main/dist/electron/features/clash-core/general-page-workflow");
const { networkModeDiagnostics } = require("../../main/dist/electron/features/profiles/network-mode-diagnostics");
const { buildTunConfig } = require("../../main/dist/electron/features/tun/build-tun-config");

function fixture(bits, tapAllowed = true, tapInstalled = true) {
    const closed = [], payloads = [];
    const vm = {
        isTunEnable: !!(bits & 4), isMixinEnable: !!(bits & 2), isSystemProxyOn: !!(bits & 1),
        settings: { mixinType: 0, mixinText: DEFAULT_MIXIN, legacyTapMode: tapAllowed ? "enabled" : "disabled" }, tunSettings: {},
        profiles: { index: 0, files: [{ time: "test.yaml" }] }, profilesPath: "/temporary", confData: {}, menuItems: [],
        clashApi: {
            isReady: () => true,
            async putConfig({ payload }) { payloads.push(yaml.parse(payload)); return { status: 204 }; },
            async getConnections() { return { status: 200, data: { connections: [
                { id: "tun", metadata: { type: "Tun" } }, { id: "http", metadata: { type: "HTTP" } },
                { id: "socks", metadata: { type: "Socks5" } }, { id: "unknown" }
            ] } }; },
            async closeConnection(id) { closed.push(id); return { status: 204 }; }
        },
        setCurrentProfilePayload({ payload }) { this.currentProfilePayload = payload; }, setMenuItems() {},
        resetDNS() {}, detectInterfaceName() { this.finalInterfaceName = "fixture"; },
        spawnTun2socks() { this.tun2socks = {}; }, killSpawned() {}
    };
    const dependencies = { platform: "win32", path, yaml, fs: { readFileSync: () => "proxies: []\nrules: []" }, messages: {},
        profileNetworkEffects: { hasTap: () => tapInstalled, renewDhcp() {} }, setDns() {} };
    const LocalVue = { prototype: {} };
    createRendererCapabilities({ platform: "win32", status: { SYSTEM_PROXY: "on" }, systemProxy: { async set() { return true; } } }).install(LocalVue, {
        store: { state: { app: vm }, getters: { clashApi: vm.clashApi, mixedPort: 7890 },
            commit(_name, { status }) { vm.isSystemProxyOn = status === "on"; } }
    });
    return { vm, closed, payloads, refresh: () => refreshProfile(vm, dependencies), system: enabled => LocalVue.prototype.$setSystemProxy(enabled) };
}

test("all eight TUN/Mixin/System Proxy combinations preserve legacy composition with TAP allowed, absent or disabled", async () => {
    for (let bits = 0; bits < 8; bits++) for (const [allowed, installed] of [[true, true], [false, true], [true, false]]) {
        const f = fixture(bits, allowed, installed);
        assert.equal((await f.refresh()).success, true, `${bits}/${allowed}/${installed}`);
        const tun = !!(bits & 4), mixin = !!(bits & 2);
        assert.equal(!!f.vm.currentProfilePayload.tun?.enable, tun);
        assert.equal(!!f.vm.tun2socks, !tun && mixin && allowed && installed);
        assert.equal(f.vm.isSystemProxyOn, !!(bits & 1));
        assert.deepEqual(f.closed, []);
        const diagnostics = networkModeDiagnostics({ config: f.vm.currentProfilePayload,
            tunRequested: tun, tunConfig: buildTunConfig({}, "win32"), systemProxyOn: f.vm.isSystemProxyOn, tapActive: !!f.vm.tun2socks });
        assert.equal(diagnostics.includes("networkDnsOverridden"), tun && mixin);
    }
});

test("all 24 single-switch transitions isolate connection cleanup between entries", async () => {
    for (let bits = 0; bits < 8; bits++) for (const bit of [4, 2, 1]) {
        const f = fixture(bits);
        assert.equal((await f.refresh()).success, true);
        const before = !!f.vm.currentProfilePayload.tun?.enable || !!f.vm.tun2socks;
        const next = bits ^ bit;
        if (bit === 1) assert.equal(await f.system(!!(next & 1)), true);
        else {
            f.vm.isTunEnable = !!(next & 4); f.vm.isMixinEnable = !!(next & 2);
            assert.equal((await f.refresh()).success, true);
        }
        if (bit === 1) assert.deepEqual(f.closed, bits & 1 ? ["http"] : [], `${bits}/${bit}`);
        else {
            const after = !!f.vm.currentProfilePayload.tun?.enable || !!f.vm.tun2socks;
            assert.equal(f.closed.includes("tun"), before && !after, `${bits}/${bit}`);
            assert.equal(f.closed.includes("http"), false);
            assert.equal(f.closed.includes("unknown"), false);
            if (f.vm.isSystemProxyOn) assert.equal(f.closed.includes("socks"), false);
        }
    }
});
