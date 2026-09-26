"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const Vue = require("../../main/node_modules/vue");
const { refreshProfile } = require("../../main/dist/electron/entry/renderer/refresh-profile");
const { createRendererCapabilities } = require("../../main/dist/electron/entry/renderer/capabilities");
const { renderConnectionDisconnectSettings } = require("../../main/dist/electron/features/connections/settings-view");

function fixture() {
    const events = [];
    const control = { status: 204, source: "proxies: []" };
    const vm = {
        profiles: { index: 0, files: [{ time: "test.yaml" }] }, profilesPath: "/temporary",
        settings: {}, confData: {}, menuItems: [], tunSettings: {},
        clashApi: {
            isReady: () => true,
            async getConnections() { events.push("snapshot"); return { status: 200, data: { connections: [{ id: "old" }] } }; },
            async closeConnection(id) { events.push(`close:${id}`); return { status: 204 }; },
            async putConfig() { events.push("apply"); return { status: control.status }; }
        },
        setCurrentProfilePayload() {}, setMenuItems() {}, resetDNS() {}, killSpawned() {},
        detectInterfaceName() { this.finalInterfaceName = "test"; },
        spawnTun2socks() { this.tun2socks = {}; }
    };
    const deps = { platform: "win32", fs: { readFileSync: () => control.source }, path, yaml,
        childProcess: { execSync: () => "cfw-tap" }, setDns() {}, getPort() {}, messages: {} };
    return { vm, events, control, refresh: () => refreshProfile(vm, deps) };
}

test("Disconnect settings: TUN refresh closes only after successful disable, retries failures, ignores duplicate refresh", async () => {
    const f = fixture();
    f.vm.isTunEnable = true;
    assert.equal((await f.refresh()).success, true);
    assert.deepEqual(f.events, ["apply"]);
    f.events.length = 0;
    f.vm.isTunEnable = false;
    f.control.status = 400;
    assert.equal((await f.refresh()).success, false);
    assert.deepEqual(f.events, ["snapshot", "apply"]);
    f.events.length = 0; f.control.status = 204;
    await Promise.all([f.refresh(), f.refresh()]);
    assert.deepEqual(f.events, ["snapshot", "apply", "close:old", "apply"]);
});

test("Disconnect settings: Mixin needs an effective TUN/TAP shutdown; opt-out and retained tunnels are respected", async () => {
    for (const kind of ["tun", "tap", "rules", "retained", "optout"]) {
        const f = fixture();
        f.vm.isMixinEnable = true;
        f.vm.settings.mixinText = kind === "tap" ? "mixin:\n  dns:\n    enable: true\n    listen: 0.0.0.0:53" :
            kind === "rules" ? "mixin:\n  rules: []" : "mixin:\n  tun:\n    enable: true\n    auto-detect-interface: true";
        if (kind === "retained") f.control.source = "tun:\n  enable: true\n  auto-detect-interface: true";
        if (kind === "optout") f.vm.settings.connProxyDisconnect = false;
        assert.equal((await f.refresh()).success, true, kind);
        f.events.length = 0;
        f.vm.isMixinEnable = false;
        assert.equal((await f.refresh()).success, true, kind);
        assert.equal(f.events.includes("close:old"), ["tun", "tap"].includes(kind), kind);
        if (["rules", "optout"].includes(kind)) assert.deepEqual(f.events, ["apply"]);
    }
});

test("Disconnect settings: System Proxy entry snapshots before OS operation and cleans up only a successful on-to-off transition", async () => {
    for (const scenario of ["disable", "failure", "enable", "already-off", "optout"]) {
        const f = fixture(), LocalVue = { prototype: {} };
        const enabled = scenario === "enable";
        if (scenario === "optout") f.vm.settings.connProxyDisconnect = false;
        createRendererCapabilities({ platform: "win32", path, status: {}, modifyState: {},
            logger: { info() {}, error() {} }, parseBypass: () => ({ bypass: [] }),
            childProcess: { spawnSync() { f.events.push("os"); return { status: scenario === "failure" ? 1 : 0 }; } }
        }).install(LocalVue, { store: {
            state: { app: { settings: f.vm.settings, isSystemProxyOn: scenario !== "already-off", clashPath: "/temporary" } },
            getters: { filesPath: "/packaged", mixedPort: 7890, clashApi: f.vm.clashApi }, commit() {}
        } });
        assert.equal(await LocalVue.prototype.$setSystemProxy(enabled), scenario !== "failure");
        assert.deepEqual(f.events, scenario === "disable" ? ["snapshot", "os", "close:old"] :
            scenario === "failure" ? ["snapshot", "os"] : ["os"]);
    }
});

test("Disconnect settings: real Vue renders independent switches and persists model callbacks", () => {
    const labels = Object.fromEntries(["breakWhenModeChange", "breakWhenModeChangeDescribe", "breakWhenProxyDisabled", "breakWhenProxyDisabledDescribe"].map(key => [key, () => key]));
    const vm = new Vue({ data: () => ({ settings: { connMode: false, connProxyDisconnect: true } }),
        components: { SwitchView: { props: ["on"], model: { prop: "on", event: "change" }, render: h => h("div") }, Info: { render: h => h("div") } },
        render(h) { return h("div", renderConnectionDisconnectSettings(this, h, labels)); }
    });
    const rows = vm._render().children;
    assert.equal(rows.length, 2);
    assert.equal(rows[1].children[1].componentOptions.propsData.on, true);
    rows[1].children[1].componentOptions.listeners.change(false);
    assert.equal(vm.settings.connProxyDisconnect, false);
    assert.equal(vm.settings.connMode, false);
    vm.$destroy();
});
