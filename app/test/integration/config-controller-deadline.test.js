"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const Vue = require("../../main/node_modules/vue");
const yaml = require("../../main/node_modules/yaml");
const axios = require("../../main/node_modules/axios/dist/node/axios.cjs");
const requireFromString = require("../../main/node_modules/require-from-string");
const { homePage } = require("../fixtures/home-page");
const { createAxiosClient } = require("../../main/dist/electron/core/network/clash-clients");
const { createClashApi } = require("../../main/dist/electron/core/network/clash-api");
const { createClashApiClient } = require("../../main/dist/electron/core/native/clash-api-client");
const { registerClashApiIpc } = require("../../main/dist/electron/entry/main/register-clash-api-ipc");
const { refreshProfile } = require("../../main/dist/electron/entry/renderer/refresh-profile");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

async function checkToggleDeadline(t, scenario) {
    let enabled = false, entered;
    const writes = [], timers = new Set();
    const server = http.createServer((request, response) => {
        if (request.method === "GET") {
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ connections: [] }));
            return;
        }
        let body = "";
        request.setEncoding("utf8");
        request.on("data", chunk => { body += chunk; });
        request.on("end", () => {
            const config = yaml.parse(JSON.parse(body).payload);
            const next = (scenario.kind === "tun" ? config.tun?.enable : config.dns?.enable) === true, changed = next !== enabled;
            enabled = next; writes.push(next);
            if (scenario.kind === "mixin") assert.equal(config.tun?.enable === true, false);
            entered?.();
            const reply = () => { response.writeHead(204); response.end(); };
            // Model a slow core reload after the PUT is accepted, independently
            // of script execution and without relying on fake HTTP timers.
            // No operating-system proxy, adapter, DNS or routing state is changed.
            if (changed) timers.add(setTimeout(reply, 10200));
            else reply();
        });
    });
    t.after(() => new Promise(resolve => {
        for (const timer of timers) clearTimeout(timer);
        server.close(resolve); server.closeAllConnections?.();
    }));
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const transport = createAxiosClient({ axios, controllerPort: server.address().port });
    const host = createClashApi({ getClient: () => transport });
    const sender = { mainFrame: {} }, event = { sender, senderFrame: sender.mainFrame };
    let handler;
    registerClashApiIpc({ ipcMain: { on() {}, handle(_channel, action) { handler = action; } },
        getMainWindow: () => ({ webContents: sender }), clashApi: host });
    const api = createClashApiClient({ isReady: () => true, ipcRenderer: {
        invoke: (_channel, operation, request) => handler(event, operation, request), send() {}
    } });
    const alerts = [], page = homePage({
        runtimeProcess: { platform: "win32", arch: "x64" }, refreshRendererProfile: refreshProfile, getLanguage: () => createTranslator(1),
        profileFiles: { readProfile: async () => "rules: []\n" }, profileNetworkEffects: { hasTap: async () => false },
        prepareMixin: async () => {}, runMixin: async payload => requireFromString(scenario.settings.mixinCode).parse(payload)
    });
    const vm = new Vue({ data: () => ({ ...page.data(), clashApi: api,
        isInitializing: false, isLaunching: false, isTunEnable: false, isMixinEnable: false,
        settings: { proxyCore: "mihomo", legacyTapMode: "disabled", ...scenario.settings }, confData: {},
        profiles: { index: 0, files: [{ time: "local.yml" }] }, profilesPath: "virtual", menuItems: [] }),
        computed: { proxyBusy: page.computed.proxyBusy }, watch: { isTunEnable: page.watch.isTunEnable, isMixinEnable: page.watch.isMixinEnable },
        methods: { ...page.methods, updateTrayIcon() {}, async killSpawned() {},
            chagneIsTunEnable({ isTun }) { this.isTunEnable = isTun; },
            changeIsMixinEnable({ isMixin }) { this.isMixinEnable = isMixin; },
            setCurrentProfilePayload({ payload }) { this.currentProfilePayload = payload; }, setMenuItems({ items }) { this.menuItems = items; },
            $alert: async message => alerts.push(message)
        }
    });
    t.after(() => vm.$destroy());
    assert.equal((await vm.refreshProfile()).success, true);
    for (const requested of [true, false]) {
        let accepted = false;
        const arrival = new Promise(resolve => { entered = () => { accepted = true; resolve(); }; });
        const pending = vm.requestProfileToggle(scenario.kind, requested);
        await Promise.race([arrival, pending]);
        assert.equal(accepted, true, "the toggle must reach the controller");
        assert.equal(vm.proxyBusy, true);
        assert.equal(await vm.requestProfileToggle(scenario.kind, !requested), false);
        assert.equal(await pending, true);
        assert.equal(vm[scenario.key], requested);
        assert.equal(vm.proxyBusy, false);
    }
    assert.deepEqual(writes, [false, true, false]);
    assert.deepEqual(alerts, []);
}

describe("full-configuration controller deadlines", { concurrency: true }, () => {
    for (const scenario of [
        { name: "TUN", kind: "tun", key: "isTunEnable", settings: {} },
        { name: "YAML Mixin", kind: "mixin", key: "isMixinEnable", settings: { mixinType: 0, mixinText: "mixin:\n  dns: {enable: true}\n" } },
        { name: "JavaScript Mixin", kind: "mixin", key: "isMixinEnable", settings: { mixinType: 1,
            mixinCode: "module.exports.parse = async ({ content }) => ({ ...content, dns: { enable: true } });" } }
    ]) {
        test(`${scenario.name} toggles survive acknowledgements beyond ten seconds without rollback or duplicate writes`,
            { timeout: 45000 }, t => checkToggleDeadline(t, scenario));
    }
});
