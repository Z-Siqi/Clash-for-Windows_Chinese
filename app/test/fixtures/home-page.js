"use strict";

const path = require("node:path");
const Vuex = require("../../main/node_modules/vuex");
const yaml = require("../../main/node_modules/yaml");
const lodash = require("../../main/node_modules/lodash");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createHomePage } = require("../../main/dist/electron/features/home/page");

const EmptyComponent = { render: h => h("span") };
const labels = new Proxy({}, { get: (_target, key) => () => String(key) });

function homePageDependencies(overrides = {}) {
    return {
        defineComponent,
        Vuex, lodash, draggable: EmptyComponent, cache: { get: () => null, put() {} },
        connectionStatus: { CONNECTED: "connected", DISCONNECTED: "disconnected" },
        proxyStatus: { SYSTEM_PROXY: "proxy", IS_TUN: "tun", IS_MIXIN: "mixin" },
        runtimeProcess: { platform: process.platform, arch: process.arch },
        electron: { ipcRenderer: { send() {}, invoke: async () => false, on() {} }, shell: { openPath() {}, openExternal() {}, showItemInFolder() {} } },
        requireFromString: () => ({ run: async () => "" }), path,
        fs: { readFileSync: () => Buffer.from(""), writeFileSync() {}, existsSync: () => true, watch: () => ({ close() {} }) },
        moment: () => ({ diff: () => 0, locale() { return this; }, fromNow: () => "now", add() { return this; }, isBefore: () => false, subtract() { return this; } }),
        scheduler: { add: () => "timer", stop() {}, pauseAll() {}, resumeAll() {} },
        keys: {}, Hint: EmptyComponent, childProcess: {},
        logger: { transports: { console: {}, file: {} }, info() {}, warn() {}, error() {} },
        os: { release: () => "10" }, httpClient: {}, yaml,
        sudoPrompt: { exec() {} }, validatePort: () => true, notify() {},
        showMessageBox: async () => ({}), updateYaml: async () => {}, hash() {}, sleep: async () => {},
        shouldReplaceWintun: () => false, detectInterface: () => [],
        store: { state: { app: { settings: {} } }, getters: { mixedPort: 7890 }, commit() {} },
        defaultPac: "", Koa: class { use() { return this; } listen() {} }, getPort: async () => 1234,
        downloadProfile: async () => ({}), net: { isIP: () => true }, runMacCommand: async () => ({ success: false }),
        uuid: { v4: () => "uuid" }, firewallRuleExists: async () => false,
        getWlanInterfaces: () => [], mousetrap: { bind() {} }, cron: function cron() {},
        serviceStatus: async () => false, serviceActiveStatus: "active",
        runtimeState: { languageInProfile: -1, language: 1, isTun: false, isMixin: false, adImages: "" },
        languageKey: "language", getLanguage: () => labels,
        refreshRendererProfile: async () => {}, createRendererConfiguration: () => ({}),
        persistSelection: async () => {}, createClashServiceApi: () => ({}),
        createTunRuntime: () => ({}), createClashCoreRuntime: () => ({}),
        isMacOS: () => false, isWindows: () => true, isLinux: () => false,
        currentTarget: () => "win32-x64",
        updateTargets: {
            windowsX64: "win32-x64", windowsIa32: "win32-ia32", windowsArm64: "win32-arm64",
            macArm64: "darwin-arm64", macX64: "darwin-x64", linuxX64: "linux-x64"
        },
        ...overrides
    };
}

function homePage(overrides = {}) {
    return createHomePage(homePageDependencies(overrides));
}

module.exports = { EmptyComponent, homePage, homePageDependencies };
