"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const yaml = require("../../main/node_modules/yaml");
const { refreshProfile, refreshTapAfterSetup } = require("../../main/dist/electron/entry/renderer/refresh-profile");

function fixture(settings = { legacyTapMode: "enabled" }) {
    const calls = [];
    const vm = { settings, profiles: { index: 0, files: [{ time: "test.yaml" }] }, profilesPath: "virtual", confData: {},
        isTunEnable: false, isMixinEnable: false, clashStatus: "connected", menuItems: [],
        clashApi: { putConfig: async () => { calls.push("put-config"); return { status: 204 }; } },
        setCurrentProfilePayload({ payload }) { this.currentProfilePayload = payload; }, setMenuItems() {}, resetDNS() {},
        killSpawned: async () => calls.push("stop-tap"), spawnTun2socks: async () => { calls.push("start-tap"); vm.tun2socks = { pid: 42 }; }
    };
    const dependencies = { yaml, platform: "win32", messages: {}, hash: () => "fixture", readProfileSource: async () => {
        calls.push("read-profile"); return "interface-name: Ethernet\ndns: {enable: true, listen: ':53'}\nproxy-providers: {remote: {type: http, url: 'http://127.0.0.1/provider'}}\nrules: ['MATCH,DIRECT']";
    }, profileNetworkEffects: { hasTap: async () => false } };
    return { vm, dependencies, calls };
}

test("TAP install reconciles the accepted policy without rerunning profile parsing, JS or Provider reloads", async () => {
    const { vm, dependencies, calls } = fixture();
    assert.equal((await refreshProfile(vm, dependencies)).success, true);
    calls.length = 0;
    assert.equal((await refreshTapAfterSetup(vm, { connectedStatus: "connected" }, true)).success, true);
    assert.deepEqual(calls, ["stop-tap", "start-tap"]);
    calls.length = 0;
    await refreshTapAfterSetup(vm, { connectedStatus: "connected" }, false);
    assert.deepEqual(calls, ["stop-tap"]);
});

test("installation never grants TAP permission to subscriptions and does not start TAP during core restart", async () => {
    for (const mode of ["disabled", "mixin"]) {
        const { vm, dependencies, calls } = fixture({ legacyTapMode: mode });
        await refreshProfile(vm, dependencies); calls.length = 0;
        await refreshTapAfterSetup(vm, { connectedStatus: "connected" }, true);
        assert.deepEqual(calls, ["stop-tap"]);
    }
    const { vm, dependencies, calls } = fixture();
    await refreshProfile(vm, dependencies); calls.length = 0; vm.clashStatus = "disconnected";
    await refreshTapAfterSetup(vm, { connectedStatus: "connected" }, true);
    assert.deepEqual(calls, ["stop-tap"]);
});

test("cancelled elevation restores an installed adapter using the accepted policy, while changed policy cannot start it", async () => {
    const { vm, dependencies, calls } = fixture();
    await refreshProfile(vm, dependencies); calls.length = 0;
    await refreshTapAfterSetup(vm, { connectedStatus: "connected", hasTap: async () => true }, undefined);
    assert.deepEqual(calls, ["stop-tap", "start-tap"]);
    calls.length = 0; vm.settings.legacyTapMode = "disabled";
    assert.equal((await refreshTapAfterSetup(vm, { connectedStatus: "connected" }, true)).success, false);
    assert.deepEqual(calls, ["stop-tap"]);
});
