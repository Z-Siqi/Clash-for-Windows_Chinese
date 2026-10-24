"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const yaml = require("../../main/node_modules/yaml");
const { homePage } = require("../fixtures/home-page");
const { refreshProfile } = require("../../main/dist/electron/entry/renderer/refresh-profile");

test("a failed compatibility change restarts the previously accepted TAP policy before restoring the switch", async t => {
    const starts = []; let applies = 0, failProtected = false;
    const dependencies = { yaml, platform: "win32", messages: {},
        readProfileSource: async () => "interface-name: Ethernet0\ndns: {enable: true, listen: ':53'}\n",
        profileNetworkEffects: { hasTap: async () => true } };
    const page = homePage({ refreshRendererProfile(vm) { applies++; return refreshProfile(vm, dependencies); } });
    const vm = new Vue({ data: () => ({ ...page.data(), isLaunching: false, isInitializing: false, isTunEnable: false, isMixinEnable: false,
        settings: { legacyTapMode: "enabled", tapAllowMulticast: true, connProxyDisconnect: false },
        clashApi: { putConfig: async () => ({ status: 204 }) }, confData: {}, mode: "rule", menuItems: [],
        profiles: { index: 0, files: [{ time: "local.yaml" }] }, profilesPath: "virtual", currentProfilePayload: {} }),
        computed: { proxyBusy: page.computed.proxyBusy },
        watch: { "settings.tapAllowMulticast": page.watch["settings.tapAllowMulticast"] },
        methods: { ...page.methods, resetDNS() {}, updateTrayIcon() {},
            setCurrentProfilePayload({ payload }) { this.currentProfilePayload = payload; },
            setMenuItems({ items }) { this.menuItems = items; }, async killSpawned() {}, async switchMode() { return true; },
            async $alert() {},
            async spawnTun2socks({ allowMulticast }) {
                starts.push(allowMulticast);
                if (failProtected && !allowMulticast) throw Error("new TAP policy failed");
                this.tun2socks = { pid: 42 };
            }
        } });
    t.after(() => vm.$destroy());
    assert.equal((await vm.refreshProfile()).success, true);
    failProtected = true;
    assert.equal(await vm.requestProfileToggle("tapMulticast", false), false);
    assert.deepEqual(starts, [true, false, true]);
    assert.equal(vm.settings.tapAllowMulticast, true);
    assert.equal(vm.tun2socks.pid, 42);
    assert.equal(applies, 2, "rollback restores the completed TAP policy without another watcher reload");
    assert.equal(vm.proxyBusy, false);
});
