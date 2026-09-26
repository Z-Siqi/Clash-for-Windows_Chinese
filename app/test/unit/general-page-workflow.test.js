"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGeneralPageWorkflow } = require("../../main/dist/electron/features/clash-core/general-page-workflow");

function createWorkflow(overrides = {}) {
    const labels = new Proxy({}, { get(_target, key) { return () => String(key); } });
    const cacheValues = new Map();
    const calls = [];
    const dependencies = {
        getLanguage: () => labels,
        path: { join: (...parts) => parts.join("/"), resolve: value => value },
        fs: {},
        moment: () => ({ format: () => "2026-09-23 10:00" }),
        yaml: { parse: () => ({}), stringify: String },
        httpClient: {}, zlib: {}, tarStream: {},
        childProcess: {}, sudoExec() {},
        electron: { ipcRenderer: { invoke: async () => "0.20.39" }, shell: {}, clipboard: {} },
        cache: { get: key => cacheValues.get(key), put: (key, value) => cacheValues.set(key, value) },
        keys: { AUTO_LAUNCH: "auto", TAP_INFO: "tap", SYSTEM_PROXY_COMMAND: "command", GEOIP_TOKEN: "token", GEOIP_URL: "url" },
        getNetworkInterfaces: () => [],
        platform: { isMacOS: () => false, isWindows: () => false, isLinux: () => true },
        updateApplication: async () => "update.exe",
        logger: { info: value => calls.push(["log", value]) },
        connectedStatus: "connected",
        service: { needUpdate: () => false, install: async () => {}, uninstall: async () => {}, update: async () => {} },
        firewall: { add: async () => {}, remove: async () => {}, status: async () => false },
        utilities: { updateYaml: async (...args) => calls.push(["yaml", ...args]), showMessageBox: async () => ({ response: 0 }), notify() {} },
        ensureMixinDefaults() {}, validateMixinSettings() {},
        schedule: callback => callback(), repeat() {},
        ...overrides
    };
    return { workflow: createGeneralPageWorkflow(dependencies), calls, cacheValues };
}

test("general page mixed-port edit validates, patches and persists one integer value", async () => {
    const patches = [], commits = [];
    const { workflow, calls } = createWorkflow();
    const page = {
        ...workflow.methods,
        port: 7890,
        settings: { randomMixedPort: true },
        clashPath: "profile",
        confData: { mode: "rule" },
        $input: async () => ({ port: "65535" }),
        clashApi: { patchConfig: async value => { patches.push(value); return { status: 204 }; } },
        setConfData: value => commits.push(value),
        setupComponent() { calls.push(["setup"]); }
    };

    await page.handleEditMixedPort();

    assert.equal(page.port, 65535);
    assert.equal(page.settings.randomMixedPort, false);
    assert.deepEqual(patches, [{ "mixed-port": 65535 }]);
    assert.deepEqual(commits, [{ data: { mode: "rule", "mixed-port": 65535 } }]);
    assert.deepEqual(calls, [["yaml", "profile/config.yaml", "mixed-port", 65535], ["setup"]]);
});

test("general page system proxy switch owns loading and store state", async () => {
    const commits = [];
    const { workflow } = createWorkflow();
    const page = {
        ...workflow.methods,
        systemProxyLoading: false,
        isSystemProxyOn: false,
        confData: { "mixed-port": 7890 },
        $setSystemProxy: async () => true,
        setIsSystemProxyOn: payload => commits.push(payload)
    };

    await page.handleSystemProxySwitchClick();

    assert.equal(page.systemProxyLoading, false);
    assert.deepEqual(commits, [{ isOn: true }]);
});

test("general page firewall toggle refreshes canonical firewall state", async () => {
    const calls = [], commits = [];
    const { workflow } = createWorkflow({
        firewall: {
            add: async () => calls.push("add"),
            remove: async () => calls.push("remove"),
            status: async () => { calls.push("status"); return true; }
        }
    });
    const page = {
        ...workflow.methods,
        isFetchingFirewallRule: false,
        isFirewallRuleExist: false,
        setIsFirewallRuleExist: payload => commits.push(payload)
    };

    await page.handleAddFirewallRules();

    assert.deepEqual(calls, ["add", "status"]);
    assert.deepEqual(commits, [{ isExist: true }]);
    assert.equal(page.isFetchingFirewallRule, false);
});

test("general page opens the trusted release page without downloading or executing an installer", async () => {
    const opened = [], copied = [];
    const { workflow } = createWorkflow({
        electron: {
            ipcRenderer: { invoke: async () => "unused" },
            shell: { openExternal: async value => opened.push(value) },
            clipboard: { writeText: value => copied.push(value) }
        },
        updateApplication: async () => { throw new Error("must not download executable updates"); },
        childProcess: { spawnSync: () => { throw new Error("must not execute installers"); } }
    });
    const releasePage = "https://github.com/Z-Siqi/Clash-for-Windows_Chinese/releases/tag/1.2.3";
    const page = {
        ...workflow.methods,
        $parent: {
            newVersionInfo: { url: "https://objects.example/app.exe", version: "1.2.3", log: "notes", releasePage },
            checkForUpdate: async () => {}
        },
        $select: async options => {
            assert.equal(options.message, "notes");
            assert.equal(options.html, undefined);
            return [0];
        },
        $alert() {}
    };

    await page.openGithubRelease();
    assert.deepEqual(opened, [releasePage]);
    assert.deepEqual(copied, []);
});

test("general page route entry loads version, service status and initializes the page", async () => {
    const calls = [];
    const { workflow } = createWorkflow({
        electron: { ipcRenderer: { invoke: async (...args) => { calls.push(["invoke", ...args]); return "1.2.3"; } }, shell: {}, clipboard: {} },
        service: { needUpdate: () => { calls.push(["service"]); return true; } },
        schedule: (callback, delay) => { calls.push(["schedule", delay]); callback(); }
    });
    const page = {
        setupComponent() { calls.push(["setup"]); },
        setupSwitches() { calls.push(["switches"]); }
    };

    workflow.beforeRouteEnter(null, null, callback => callback(page));
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(page.version, "v1.2.3");
    assert.equal(page.serviceNeedUpdate, true);
    assert.deepEqual(calls, [
        ["invoke", "app", "getVersion"], ["service"], ["setup"], ["schedule", 1], ["switches"]
    ]);
});
