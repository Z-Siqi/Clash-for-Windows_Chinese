"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const yaml = require("../../main/node_modules/yaml");
const { homePage } = require("../fixtures/home-page");
const { buildStore } = require("../fixtures/renderer-store");
const { createRendererConfiguration } = require("../../main/dist/electron/entry/renderer/configuration");
const { refreshProfile } = require("../../main/dist/electron/entry/renderer/refresh-profile");
const { createSettingsRepository } = require("../../main/dist/electron/features/settings/settings-repository");
const { ensureMixinDefaults, validateMixinSettings } = require("../../main/dist/electron/features/mixin/mixin-runtime");

for (const core of ["mihomo", "clash"]) for (const firstToggle of ["mixin", "tun"]) {
    test(`fresh ${core} startup applies its default before the first ${firstToggle} toggle without visiting Profiles`, async t => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-fresh-toggle-"));
        t.after(() => fs.rmSync(root, { recursive: true, force: true }));
        const home = path.join(root, ".config", "clash"), assets = path.join(root, "assets");
        fs.mkdirSync(path.join(assets, "default"), { recursive: true });
        fs.writeFileSync(path.join(assets, "default", "Country.mmdb"), "fixture");
        const { store } = buildStore({ home });
        const settings = createSettingsRepository({ fs, path, yaml });
        if (core === "clash") { fs.mkdirSync(home, { recursive: true }); settings.save(home, { proxyCore: core }); }
        const payloads = [], routes = [], alerts = [];
        const api = { isReady: () => true, getConnections: async () => ({ status: 200, data: { connections: [] } }),
            async putConfig({ payload }) { payloads.push(yaml.parse(payload)); return { status: 204 }; } };
        const runtime = { start: async () => ({}), stop: async () => {}, getStatus: async () => ({ connected: true, mixedPort: 7890 }) };
        const page = homePage({
            fs, path, yaml, uuid: { v4: () => "" }, createRendererConfiguration,
            runtimeProcess: { platform: "linux", arch: "x64" }, isWindows: () => false, isLinux: () => true,
            createClashCoreRuntime: () => runtime,
            prepareMixin: async value => { ensureMixinDefaults(value); validateMixinSettings(value, { parseYaml: yaml.parse }); },
            profileNetworkEffects: { hasTap: async () => false }, refreshRendererProfile: refreshProfile,
            electron: { shell: {}, ipcRenderer: { send() {}, on() {}, async invoke(channel, operation, name) {
                if (channel === "app" && operation === "getPath") return name === "home" ? root : path.join(root, "app", "cfw");
                if (channel === "app" && operation === "getRuntimeInfo") return { portableDataExists: false, release: "10" };
                return channel === "app" && operation === "isPackaged";
            } } }
        });
        const vm = new Vue({ store, data: page.data,
            computed: { ...page.computed, filesPath: () => assets, settings: () => store.state.app.settings, clashApi: () => api },
            watch: { isTunEnable: page.watch.isTunEnable, isMixinEnable: page.watch.isMixinEnable },
            methods: { ...page.methods,
                loadSettings() { store.commit("SET_SETTINGS_OBJECT", { obj: settings.load(home) }); },
                async detectInterfaceName() { this.setDetectedInterfaceName({ interfaceName: "test-interface" }); },
                async setSSIDOptions() {}, async killSpawned() {}, async spawnUserDefindExes() {},
                async checkForUpdate() {}, async profileUpdater() {},
                $alert: async message => { alerts.push(message); }
            }
        });
        t.after(() => vm.$destroy());
        vm.$router = { replace: async route => { routes.push(route.path); } };
        // Keep the startup hook's background polls local to this fixture.
        t.mock.method(global, "setTimeout", () => ({}));
        t.mock.method(global, "setInterval", () => ({}));
        await page.beforeMount.call(vm);
        assert.deepEqual(routes, ["/home/general"]);
        assert.equal(vm.proxyBusy, false);
        assert.equal(vm.profiles.index, 0);
        assert.equal(vm.profiles.files.length, 1);
        assert.equal(payloads.length, 1, "the initial profile must reach the core during startup");
        assert.equal(vm.settings.proxyCore, core);
        const initialList = fs.readFileSync(path.join(vm.profilesPath, "list.yml"), "utf8");
        const otherToggle = firstToggle === "mixin" ? "tun" : "mixin";
        for (const kind of [firstToggle, otherToggle]) {
            assert.equal(await vm.requestProfileToggle(kind, true), true);
            assert.equal(kind === "tun" ? vm.isTunEnable : vm.isMixinEnable, true);
            assert.equal(payloads.at(-1).dns.enable, true);
            if (vm.isTunEnable) assert.equal(payloads.at(-1).tun.enable, true);
        }
        assert.equal(await vm.requestProfileToggle(firstToggle, false), true);
        assert.deepEqual(alerts, []);
        assert.deepEqual(routes, ["/home/general"]);
        assert.equal(fs.readFileSync(path.join(vm.profilesPath, "list.yml"), "utf8"), initialList);
    });
}
