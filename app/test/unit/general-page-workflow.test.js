"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGeneralPageWorkflow } = require("../../main/dist/electron/features/clash-core/general-page-workflow");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

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
        checkMixedPort: async () => true,
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

test("the legacy Script tester is available only for Clash, including direct action calls", async () => {
    const { workflow } = createWorkflow();
    let opened = 0;
    const page = { settings: { proxyCore: "mihomo" }, $script: async () => { opened++; } };
    assert.equal(workflow.computed.scriptModeVisible.call(page), false);
    assert.equal(await workflow.methods.handleShowScriptTestDialog.call(page), false);
    assert.equal(opened, 0);
    page.settings.proxyCore = "clash";
    assert.equal(workflow.computed.scriptModeVisible.call(page), true);
    await workflow.methods.handleShowScriptTestDialog.call(page);
    assert.equal(opened, 1);
});

test("General dialogs localize service status, later/copy buttons, port validation and GeoIP fields", async () => {
    for (const language of [0, 1]) {
        const labels = createTranslator(language), dialogs = [], inputs = [], alerts = [];
        const { workflow } = createWorkflow({ getLanguage: () => labels,
            platform: { isMacOS: () => true, isWindows: () => false, isLinux: () => false },
            utilities: { showMessageBox: async options => { dialogs.push(options); return { response: 1 }; } } });
        const page = { ...workflow.data(), ...workflow.methods, isLocalMode: false, proxyBusy: false,
            $parent: { requestSystemProxy: async () => false },
            $select: async () => [0], $input: async options => { inputs.push(options); throw Error("cancel"); },
            setupComponent() {}, $alert: options => alerts.push(options) };
        await page.installService();
        assert.equal(dialogs.at(-1).message, labels.serviceAlreadyInstalled());
        page.isLocalMode = true;
        await page.handleSystemProxySwitchClick();
        assert.equal(dialogs.at(-1).buttons[1], labels.later());
        await page.handleEditMixedPort();
        assert.equal(inputs.at(-1).data[0].validate("0"), labels.invalidPort());
        assert.equal(inputs.at(-1).data[0].validate("7890"), "");
        await page.handlePortClick();
        assert.equal(inputs.at(-1).confirmText, labels.copy());
        await page.updateGeoipDB();
        assert.equal(inputs.at(-1).data[0].name, labels.maxMindLicenseKey());
        const windows = createWorkflow({ getLanguage: () => labels, platform: { isWindows: () => true } }).workflow;
        await windows.methods.updateGeoipDB.call({ $alert: options => alerts.push(options) });
        assert.equal(alerts.at(-1).title, labels.note());
    }
});

test("core switching clears the old version and discards an in-flight response", async () => {
    const { workflow } = createWorkflow();
    let finishOld;
    const page = {
        ...workflow.data(), ...workflow.methods,
        clashStatus: "connected", settings: { proxyCore: "clash" },
        clashApi: { isReady: () => true, getVersion: () => new Promise(resolve => { finishOld = resolve; }) }
    };
    page.clashCoreVersion = "old";
    const oldRequest = page.fetchCoreVersion();
    page.settings.proxyCore = "mihomo";
    workflow.watch["settings.proxyCore"].call(page);
    assert.equal(page.clashCoreVersion, "");
    page.clashApi.getVersion = async () => ({ status: 200, data: { version: "v1.19.0", meta: true } });
    await page.fetchCoreVersion();
    finishOld({ status: 200, data: { version: "2023.08.17", premium: true } });
    await oldRequest;
    assert.equal(page.clashCoreVersion, "Mihomo v1.19.0");
});

test("disconnect invalidates pending core versions and reconnect refreshes the page", async () => {
    const { workflow } = createWorkflow();
    let finish;
    let refreshes = 0;
    const page = {
        ...workflow.data(), ...workflow.methods,
        clashStatus: "connected", settings: { proxyCore: "clash" },
        setupComponent() { refreshes++; },
        clashApi: { isReady: () => true, getVersion: () => new Promise(resolve => { finish = resolve; }) }
    };
    const pending = page.fetchCoreVersion();
    page.clashStatus = "disconnected";
    workflow.watch.clashStatus.call(page, "disconnected");
    finish({ status: 200, data: { version: "old" } });
    await pending;
    assert.equal(page.clashCoreVersion, "");
    await page.fetchCoreVersion();
    page.clashStatus = "connected";
    workflow.watch.clashStatus.call(page, "connected");
    assert.equal(refreshes, 1);
});

test("the Mihomo version action opens an HTTPS dashboard accepted by navigation policy", async () => {
    let opened;
    const { workflow } = createWorkflow({ electron: { shell: { openExternal: async url => { opened = url; } } } });
    await workflow.methods.handleCopyControllerURL.call({ controllerPort: 9090, secret: "", settings: { proxyCore: "mihomo" } });
    const { normalizeExternalUrl } = require("../../main/dist/electron/core/network/external-url-policy");
    assert.ok(normalizeExternalUrl(opened, { allowLoopbackHttp: true }));
    assert.equal(new URL(opened).searchParams.get("port"), "9090");
});

test("general page mixed-port edit validates, patches and persists one integer value", async () => {
    const patches = [], commits = [];
    const { workflow, calls } = createWorkflow();
    let actualPort = 7890;
    const page = {
        ...workflow.methods,
        port: 7890,
        settings: { randomMixedPort: true },
        clashPath: "profile",
        confData: { mode: "rule" },
        $input: async () => ({ port: "65535" }),
        $parent: { runProxyOperation: async (name, action) => { assert.equal(name, "port"); return action(); } },
        clashApi: {
            getConfig: async () => ({ status: 200, data: { "mixed-port": actualPort } }),
            patchConfig: async value => { patches.push(value); actualPort = value["mixed-port"]; return { status: 204 }; }
        },
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

test("general page system proxy switch delegates to the shared operation owner", async () => {
    const requests = [];
    const { workflow } = createWorkflow();
    const page = {
        ...workflow.methods,
        systemProxyLoading: false,
        isSystemProxyOn: false,
        confData: { "mixed-port": 7890 },
        $parent: { requestSystemProxy: async enabled => { requests.push(enabled); return true; } }
    };

    await page.handleSystemProxySwitchClick();

    assert.equal(page.systemProxyLoading, false);
    assert.deepEqual(requests, [true]);
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

test("service install, update and uninstall keep the blocker through relaunch", async () => {
    for (const action of ["install", "update", "uninstall"]) {
        let finishService, finishReload;
        let operations = 0;
        const { workflow } = createWorkflow({ service: {
            [action]: () => { operations++; return new Promise(resolve => { finishService = resolve; }); }
        } });
        const home = { serviceOperation: "" };
        Object.defineProperty(home, "proxyBusy", { get: () => !!home.serviceOperation });
        const page = {
            ...workflow.data(), ...workflow.methods, $parent: home, devMode: false,
            $nextTick: async () => {},
            reloadElectron: () => new Promise(resolve => { finishReload = resolve; })
        };
        const request = page.applyServiceChange(action);
        assert.equal(home.serviceOperation, "applying");
        await Promise.resolve();
        assert.equal(await page.applyServiceChange(action), false);
        assert.equal(operations, 1);
        finishService();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(home.serviceOperation, "restarting");
        finishReload();
        assert.equal(await request, true);
        assert.equal(home.serviceOperation, "restarting");
    }
});

test("service failures and development mode release the blocker; cancelled dialogs do not start work", async () => {
    for (const failure of ["service", "reload", null]) {
        const { workflow } = createWorkflow({ service: { install: async () => {
            if (failure === "service") throw Error("service failed");
        } } });
        const home = { proxyBusy: false, serviceOperation: "" };
        const page = {
            ...workflow.data(), ...workflow.methods, $parent: home, devMode: !failure,
            $nextTick: async () => {},
            reloadElectron: async () => { if (failure === "reload") throw Error("reload failed"); },
            $select: async () => { throw Error("cancelled"); }
        };
        if (failure) await assert.rejects(page.applyServiceChange("install"), /failed/);
        else assert.equal(await page.applyServiceChange("install"), true);
        assert.equal(home.serviceOperation, "");
        await page.installService();
        assert.equal(page.serviceDialogOpen, false);
        assert.equal(home.serviceOperation, "");
    }
});

test("General status refresh cannot reset an in-flight shared system proxy lock", () => {
    const { workflow } = createWorkflow();
    const page = { ...workflow.data(), $parent: { proxyOperation: "system", proxyBusy: true } };
    workflow.methods.setupSwitches.call(page);
    assert.equal(workflow.computed.systemProxyBusy.call(page), true);
    assert.equal(workflow.computed.proxyBusy.call(page), true);
});

test("shared profile reloads disable both switches but only the initiating switch shows progress", () => {
    const { workflow } = createWorkflow();
    for (const operation of ["tun", "mixin", ""]) {
        const page = { $parent: { proxyOperation: operation, profileApplyCount: 1, proxyBusy: true } };
        assert.equal(workflow.computed.tunLoading.call(page), operation === "tun");
        assert.equal(workflow.computed.mixinLoading.call(page), operation === "mixin");
        assert.equal(workflow.computed.proxyBusy.call(page), true);
    }
});

test("final configuration action opens an in-app status dialog before the optional read-only preview", async () => {
    const { workflow } = createWorkflow({ yaml: { stringify: () => "tun:\n  enable: false" } });
    const calls = [];
    const page = {
        networkStateKnown: true, currentProfilePayload: { tun: { enable: false } }, networkWarnings: ["networkTunOverridden"],
        proxyBusy: true, $parent: { tun2socks: null },
        $select: async options => { calls.push(options); return [0]; },
        $code: async options => { calls.push(options); }
    };
    await workflow.methods.handlePreviewCurrentPayload.call(page);
    assert.equal(calls[0].title, "networkConfiguration");
    assert.match(calls[0].message, /networkTunOverridden/);
    assert.match(calls[0].message, /networkApplying/);
    assert.deepEqual(calls[0].items, ["previewSubmittedConfiguration", "cancel"]);
    assert.equal(calls[1].readOnly, true);
    calls.length = 0; page.$select = async options => { calls.push(options); return [1]; };
    await workflow.methods.handlePreviewCurrentPayload.call(page);
    assert.equal(calls.length, 1);
});
