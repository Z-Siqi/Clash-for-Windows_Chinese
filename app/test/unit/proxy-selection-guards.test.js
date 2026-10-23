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

test("rapid selections serialize within one group, preserve other groups and publish successful core choices", async () => {
    const { vm, effects } = fixture();
    vm.proxies = ["Auto", "Other"].map(name => ({ name, data: { now: "old", all: [] } }));
    const calls = [], pending = [];
    vm.clashApi.selectProxy = (group, name) => new Promise(resolve => { calls.push([group, name]); pending.push(resolve); });
    const first = vm.switchProxy("Auto", "one");
    const second = vm.switchProxy("Auto", "two");
    const other = vm.switchProxy("Other", "independent");
    assert.deepEqual(calls, [["Auto", "one"], ["Other", "independent"]]);
    pending[1]({ status: 204 }); await other;
    pending[0]({ status: 204 }); await first; await Promise.resolve();
    assert.deepEqual(calls.at(-1), ["Auto", "two"]);
    assert.equal(vm.proxies[0].data.now, "one", "the UI must reflect the last successful write while the next is pending");
    pending[2]({ status: 204 }); await second;
    assert.equal(vm.proxies[0].data.now, "two");
    assert.equal(vm.proxies[1].data.now, "independent");
    assert.deepEqual(effects, ["persist", "disconnect", "persist", "disconnect", "persist", "disconnect"]);
});

test("a failed final queued choice retains and persists the preceding successful core selection", async () => {
    for (const failure of ["status", "transport"]) {
        const { vm, effects } = fixture();
        vm.proxies = [{ name: "Auto", data: { now: "old" } }];
        let finish;
        vm.clashApi.selectProxy = (_group, name) => name === "one" ? new Promise(resolve => { finish = resolve; })
            : failure === "status" ? Promise.resolve({ status: 404 }) : Promise.reject(Error("missing node"));
        const first = vm.switchProxy("Auto", "one");
        const second = vm.switchProxy("Auto", "missing");
        const completed = failure === "transport" ? assert.rejects(second, /missing node/) : second;
        finish({ status: 204 }); await first; await completed;
        assert.equal(vm.proxies[0].data.now, "one");
        assert.deepEqual(effects, ["persist", "disconnect"]);
    }
});

test("failed selections release their group queue and queued choices cannot cross profiles", async () => {
    const { vm, effects } = fixture();
    vm.proxies = [{ name: "Auto", data: { now: "old" } }];
    let fail;
    const calls = [];
    vm.clashApi.selectProxy = (_group, name) => {
        calls.push(name);
        return name === "first" ? new Promise((_resolve, reject) => { fail = reject; }) : Promise.resolve({ status: 204 });
    };
    const first = vm.switchProxy("Auto", "first");
    const rejected = assert.rejects(first, /fixture/);
    const queued = vm.switchProxy("Auto", "obsolete");
    vm.profileRefreshTimes++;
    fail(Error("fixture failure")); await rejected; await queued;
    assert.deepEqual(calls, ["first"]); assert.deepEqual(effects, []);
    await vm.switchProxy("Auto", "current");
    assert.equal(vm.proxies[0].data.now, "current");
});
