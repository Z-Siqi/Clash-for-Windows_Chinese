"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createProxiesPage } = require("../../main/dist/electron/features/proxies/page");

function fixture() {
    const page = createProxiesPage({ defineComponent: options => options,
        Vuex: { mapState: () => ({}), mapGetters: () => ({}), mapMutations: () => ({}), mapActions: () => ({}) },
        lodash: { debounce: fn => fn } });
    const effects = [];
    const vm = { ...page.data(), ...page.methods, settings: {}, delayKeyName: "delay", profileRefreshTimes: 0, currentProfilePayload: {},
        $parent: { proxyBusy: false, persistSelectedProxy: () => effects.push("persist"), breakConnections: () => effects.push("disconnect") },
        clashApi: { isReady: () => true, selectProxy: async () => ({ status: 204 }),
            getProxyProviders: async () => ({ data: { providers: {} } }),
            getProxies: async () => ({ data: { proxies: { Auto: { type: "Selector", now: "old", all: ["old", "new"] } } } }) } };
    return { vm, effects };
}

test("node selection cannot bypass the active core/profile operation guard", async () => {
    const { vm, effects } = fixture(); let requests = 0;
    vm.$parent.proxyBusy = true;
    vm.clashApi.selectProxy = async () => { requests++; return { status: 204 }; };
    await vm.switchProxy("Auto", "new");
    assert.equal(requests, 0);
    assert.deepEqual(effects, []);
});

test("an obsolete node selection cannot persist into a newly fetched profile", async () => {
    const { vm, effects } = fixture(); let finish;
    await vm.fetchData();
    vm.clashApi.selectProxy = () => new Promise(resolve => { finish = resolve; });
    const selecting = vm.switchProxy("Auto", "new");
    vm.profileRefreshTimes++;
    vm.currentProfilePayload = {};
    await vm.fetchData();
    finish({ status: 204 }); await selecting;
    assert.equal(vm.proxies[0].data.now, "old");
    assert.deepEqual(effects, []);
});

test("an ordinary refresh of the same profile does not discard a valid node selection", async () => {
    const { vm, effects } = fixture(); let finish;
    await vm.fetchData();
    vm.clashApi.selectProxy = () => new Promise(resolve => { finish = resolve; });
    const selecting = vm.switchProxy("Auto", "new");
    await vm.fetchData();
    finish({ status: 204 }); await selecting;
    assert.equal(vm.proxies[0].data.now, "new");
    assert.deepEqual(effects, ["persist", "disconnect"]);
});
