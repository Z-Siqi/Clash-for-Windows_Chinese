"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLogsPage } = require("../../main/dist/electron/features/logs/page");
const { createProxiesPage } = require("../../main/dist/electron/features/proxies/page");
const { createSettingsPageOptions } = require("../../main/dist/electron/features/settings/page-options");
const { createGeneralPageWorkflow } = require("../../main/dist/electron/features/clash-core/general-page-workflow");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { homePage } = require("../fixtures/home-page");

const Vuex = { mapState: () => ({}), mapGetters: () => ({}), mapMutations: () => ({}), mapActions: () => ({}) };
function pending() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test("editing the default YAML Mixin applies it without introducing an extra startup refresh", async () => {
    const Vue = require("../../main/node_modules/vue");
    const watcher = homePage().watch["settings.mixinText"];
    let refreshes = 0;
    const home = new Vue({ data: () => ({ settings: {}, isMixinEnable: true, isLaunching: true, restoringAppliedProfileState: false }),
        watch: { "settings.mixinText": watcher }, methods: { refreshProfile() { refreshes++; } } });
    Vue.set(home.settings, "mixinText", "mixin: {}\n"); await Vue.nextTick();
    assert.equal(refreshes, 0);
    home.isLaunching = false;
    const workflow = createGeneralPageWorkflow({ getLanguage: () => createTranslator(1), cache: { get() {} }, keys: {} });
    await workflow.methods.handleEditMixin.call({ settings: home.settings, $code: async () => ({ code: "mixin:\n  ipv6: true\n" }) });
    await Vue.nextTick();
    assert.equal(refreshes, 1); assert.equal(home.settings.mixinType, undefined);
    home.restoringAppliedProfileState = true; home.settings.mixinText = "mixin: {}\n"; await Vue.nextTick();
    assert.equal(refreshes, 1, "restoring state must not introduce a default-type reload");
    home.restoringAppliedProfileState = false; home.settings.mixinType = 1;
    home.settings.mixinText = "mixin:\n  ipv6: false\n"; await Vue.nextTick();
    assert.equal(refreshes, 1, "explicit JavaScript mode remains unchanged");
    home.$destroy();
});

test("Logs opens one stream only, preserves Pause through hide/reconnect, and cannot reopen after route leave", () => {
    const clients = [];
    const page = createLogsPage({ defineComponent: options => options, Vuex, connectedStatus: "connected", cache: { get() {} }, keys: {} });
    const vm = { ...page.data(), ...page.methods, isActive: true, clashStatus: "connected", clashWSClient: () => {
        const client = { readyState: 1, handlers: {}, on(name, callback) { this.handlers[name] = callback; }, terminate() { this.terminated = true; } };
        clients.push(client); return client;
    }, parseLog() { assert.fail("a retired stream must not append logs"); }, $refs: { list: { removeEventListener() {} } } };
    vm.openLogStream(); vm.openLogStream(); vm.handleWindowEvent(true);
    assert.equal(clients.length, 1);
    vm.handleBtnClick(); assert.equal(vm.isPaused, true); assert.equal(clients[0].terminated, true);
    vm.handleWindowEvent(false); vm.handleWindowEvent(true); vm.openLogStream();
    assert.equal(clients.length, 1);
    vm.handleBtnClick(); assert.equal(clients.length, 2);
    clients[0].handlers.message("{}");
    page.beforeRouteLeave.call(vm, {}, {}, () => {});
    vm.handleWindowEvent(true); assert.equal(clients.length, 2); assert.equal(clients[1].terminated, true);
});

test("right-click Copy also works for ordinary log messages without a remote address", () => {
    const copied = [], notifications = [];
    const page = createLogsPage({ defineComponent: options => options, Vuex, connectedStatus: "connected", cache: { get() {} }, keys: {},
        getLanguage: () => createTranslator(1), clipboard: { writeText: value => copied.push(value) }, notify: (...args) => notifications.push(args) });
    const vm = { ...page.data(), ...page.methods };
    vm.copyPayload({ msg: "fixture startup message", fields: [] });
    vm.copyPayload({ msg: "connection", fields: [{ key: "rAddr", value: "fixture.test:443" }] });
    assert.deepEqual(copied, ["fixture startup message", "fixture.test:443"]);
    assert.equal(notifications.length, 2);
});

test("a cancelled proxy speed test cannot overwrite a newer test or a newly loaded profile", async () => {
    const page = createProxiesPage({ defineComponent: options => options, Vuex, lodash: { debounce: fn => fn } });
    const first = pending(), second = pending();
    const vm = { ...page.data(), ...page.methods, settings: { proxyCore: "mihomo" }, currentProfilePayload: {}, profileRefreshTimes: 0,
        proxies: [{ name: "G", data: { all: [{ name: "N", latency: "" }] } }], speedtest: () => first.promise };
    Object.defineProperty(vm, "proxyInMode", { get: () => vm.proxies });
    const old = vm.handleSingleSpeedtest(vm.proxies[0], vm.proxies[0].data.all[0]);
    vm.speedtest = () => second.promise;
    const current = vm.handleSingleSpeedtest(vm.proxies[0], vm.proxies[0].data.all[0]);
    second.resolve(12); await current;
    first.resolve(999); await old;
    assert.equal(vm.proxies[0].data.all[0].latency, "12 ms");
    const delayed = pending(); vm.speedtest = () => delayed.promise;
    const stale = vm.handleSingleSpeedtest(vm.proxies[0], vm.proxies[0].data.all[0]);
    vm.currentProfilePayload = {}; vm.proxies = [{ name: "G", data: { all: [{ name: "N", latency: "23 ms" }] } }];
    delayed.resolve(999); await stale;
    assert.equal(vm.proxies[0].data.all[0].latency, "23 ms");
});

test("group speed tests are awaitable and cancellation clears pending indicators without painting timeout results", async () => {
    const page = createProxiesPage({ defineComponent: options => options, Vuex, lodash: { debounce: fn => fn } });
    const delay = pending();
    const vm = { ...page.data(), ...page.methods, settings: {}, currentProfilePayload: {},
        proxies: [{ name: "G", data: { all: [{ name: "N", latency: "" }] } }], speedtest: () => delay.promise };
    const test = vm.startLatencyTest("G", 0);
    assert.equal(vm.proxies[0].data.all[0].latency, -1);
    vm.cancelLatencyTest(); assert.equal(vm.proxies[0].data.all[0].latency, "");
    delay.resolve(999); await test;
    assert.equal(vm.proxies[0].data.all[0].latency, "");
});

test("a periodic proxy refresh cannot detach an active group's speed results from the displayed rows", async () => {
    const page = createProxiesPage({ defineComponent: options => options, Vuex, lodash: { debounce: fn => fn } });
    const delay = pending();
    const vm = { ...page.data(), ...page.methods, settings: {}, currentProfilePayload: {},
        proxies: [{ name: "G", data: { all: [{ name: "N", latency: "" }] } }], speedtest: () => delay.promise };
    const testing = vm.startLatencyTest("G", 0);
    assert.deepEqual(vm.testingProxyNames, ["N"]);
    vm.proxies = [{ name: "G", data: { all: [{ name: "N", latency: -1 }] } }];
    delay.resolve(15); await testing;
    assert.equal(vm.proxies[0].data.all[0].latency, "15 ms"); assert.deepEqual(vm.testingProxyNames, []);
});

test("group delay sorting follows the currently displayed array after a periodic refresh", async () => {
    const page = createProxiesPage({ defineComponent: options => options, Vuex, lodash: { debounce: fn => fn } });
    const slow = pending(), fast = pending();
    const rows = () => [{ name: "slow", delay: 0 }, { name: "fast", delay: 0 }];
    const vm = { ...page.data(), ...page.methods, settings: { proxyOrder: 1 }, currentProfilePayload: {},
        proxies: [{ name: "G", data: { all: rows() } }], speedtest: name => name === "slow" ? slow.promise : fast.promise };
    const testing = vm.startLatencyTest("G", 0);
    vm.proxies = [{ name: "G", data: { all: rows() } }];
    slow.resolve(1000); fast.resolve(10); await testing;
    assert.deepEqual(vm.proxies[0].data.all.map(row => [row.name, row.delay]), [["fast", 10], ["slow", 1000]]);
});

test("SSID picker cancellation is quiet and a native query failure is reported without copying undefined", async () => {
    const errors = [], copied = [];
    let fail = false;
    const page = createSettingsPageOptions({ Vuex, getLanguage: () => createTranslator(1),
        getWlanInterfaces: async () => { if (fail) throw Error("timeout"); return [{ SSID: "fixture" }]; },
        electron: { clipboard: { writeText: value => copied.push(value) } }, showMessageBox: async options => errors.push(options) });
    const vm = { $select: async () => { throw Error("cancelled"); } };
    await page.methods.handleFetchCurrentSSID.call(vm); assert.deepEqual(errors, []);
    fail = true; await page.methods.handleFetchCurrentSSID.call(vm);
    assert.equal(errors.length, 1); assert.deepEqual(copied, []);
});

test("cancelling the GeoIP dialog is quiet and duplicate clicks cannot open a second editor", async () => {
    const editor = pending(); let opened = 0, errors = 0;
    const workflow = createGeneralPageWorkflow({ getLanguage: () => createTranslator(1), cache: { get() {} }, keys: {},
        platform: { isWindows: () => false } });
    const vm = { ...workflow.data(), ...workflow.methods, $input: async () => { opened++; return editor.promise; }, $alert: () => { errors++; } };
    const first = vm.updateGeoipDB(); await vm.updateGeoipDB(); assert.equal(opened, 1);
    editor.resolve({}); await first;
    assert.equal(errors, 0); assert.equal(vm.geoipUpdating, false);
    vm.$input = async () => { throw Error("cancelled"); };
    await vm.updateGeoipDB(); assert.equal(errors, 0); assert.equal(vm.geoipUpdating, false);
});

test("a failed firewall status refresh cannot permanently disable its action", async () => {
    const workflow = createGeneralPageWorkflow({ getLanguage: () => createTranslator(1), cache: { get() {} }, keys: {},
        firewall: { add: async () => {}, status: async () => { throw Error("native status unavailable"); } } });
    const vm = { ...workflow.data(), ...workflow.methods, setIsFirewallRuleExist() {} };
    await assert.rejects(vm.handleAddFirewallRules(), /native status unavailable/);
    assert.equal(vm.isFetchingFirewallRule, false);
});

test("a slow scheduled subscription is not downloaded twice and other due subscriptions can still run", async () => {
    const delayed = pending(), calls = [];
    const options = homePage({ cron: class { isMatchDate() { return true; } },
        profileFiles: { modificationTimes: async () => ({}), cleanupOrphans: async () => {} },
        downloadProfile: async ({ url }) => { calls.push(url); return url.endsWith("slow") ? delayed.promise : { success: true }; } });
    const vm = { ...options.data(), profiles: { index: -1, files: [{ url: "http://127.0.0.1/slow", time: "a.yaml", cron: "* * * * *" }] } };
    const first = options.methods.profileUpdater.call(vm);
    await new Promise(setImmediate);
    vm.profiles.files.push({ url: "http://127.0.0.1/fast", time: "b.yaml", cron: "* * * * *" });
    await options.methods.profileUpdater.call(vm);
    assert.deepEqual(calls, ["http://127.0.0.1/slow", "http://127.0.0.1/fast"]);
    delayed.resolve({ success: true }); await first;
});
