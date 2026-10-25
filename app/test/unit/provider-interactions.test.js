"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createProvidersPage } = require("../../main/dist/electron/features/providers/page");

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function fixture(api) {
    const page = createProvidersPage({ defineComponent: options => options,
        Vuex: { mapState: () => ({}), mapGetters: () => ({}) },
        getLanguage: () => ({ couldNotUpdateProvider: () => "failed" }) });
    const vm = { ...page.data(), ...page.methods, clashApi: api,
        $set(array, index, value) { array[index] = value; } };
    return { page, vm };
}
const provider = name => ({ name, vehicleType: "HTTP", proxies: [], isChecking: false, isUpdating: false, message: "" });
const response = name => ({ status: 200, data: { providers: { [name]: provider(name) } } });

test("late Provider updates cannot overwrite a new profile's row at the old index", async () => {
    const pending = deferred();
    const { vm } = fixture({ updateProxyProvider: () => pending.promise,
        getProxyProviders: async () => response("new"), getRuleProviders: async () => response("new-rule") });
    vm.providers = [provider("old")];
    vm.fetchSingleData = async () => provider("old");
    const update = vm.handleProviderUpdate(0);
    await vm.fetchData();
    pending.resolve({ status: 204 });
    await update;
    assert.equal(vm.providers[0].name, "new");
});

test("concurrent Provider update and health check preserve each other's progress and metadata", async () => {
    const health = deferred(), update = deferred();
    const { vm } = fixture({ healthCheckProxyProvider: () => health.promise, updateProxyProvider: () => update.promise });
    vm.providers = [provider("one")];
    vm.fetchSingleData = async () => ({ ...provider("one"), updatedAt: "new-version" });
    const checking = vm.handleHealthCheck(0), updating = vm.handleProviderUpdate(0);
    health.resolve(); await checking;
    assert.equal(vm.providers[0].isUpdating, true);
    update.resolve({ status: 204 }); await updating;
    assert.equal(vm.providers[0].updatedAt, "new-version");
    assert.equal(vm.providers[0].isChecking, false);
});

test("an older Provider fetch cannot replace a newer response", async () => {
    const old = deferred();
    let count = 0;
    const { vm } = fixture({ getProxyProviders: () => ++count === 1 ? old.promise : Promise.resolve(response("new")),
        getRuleProviders: async () => response("rules") });
    const previous = vm.fetchData();
    await vm.fetchData();
    old.resolve(response("old")); await previous;
    assert.equal(vm.providers[0].name, "new");
});

test("Provider health checks ignore duplicate clicks and leaving the page invalidates late results", async () => {
    const pending = deferred(); let calls = 0;
    const { page, vm } = fixture({ healthCheckProxyProvider() { calls++; return pending.promise; } });
    vm.providers = [provider("one")];
    const checking = vm.handleHealthCheck(0);
    const duplicate = vm.handleHealthCheck(0);
    assert.equal(calls, 1);
    page.beforeRouteLeave.call(vm, {}, {}, () => {});
    vm.providers = [provider("new")];
    pending.resolve(); await Promise.all([checking, duplicate]);
    assert.equal(vm.providers[0].name, "new");
});

test("failed Provider refresh releases obsolete progress flags without unhandled rejections", async () => {
    const { vm } = fixture({ getProxyProviders: async () => { throw Error("offline"); }, getRuleProviders: async () => response("rules") });
    vm.providers = [{ ...provider("one"), isUpdating: true, isChecking: true }];
    await vm.fetchData();
    assert.equal(vm.providers[0].isUpdating, false);
    assert.equal(vm.providers[0].isChecking, false);
});
