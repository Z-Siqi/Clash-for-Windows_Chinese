"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createProvidersPage } = require("../../main/dist/electron/features/providers/page");
const { assertRendererComposition } = require("../fixtures/assert-renderer-composition");

Vue.use(Vuex);
const EmptyComponent = { render: h => h("span") };
const labels = new Proxy({}, { get: (_target, key) => () => String(key) });

function createPage(overrides = {}) {
    return createProvidersPage({
        defineComponent, Vuex, getLanguage: () => labels,
        moment: () => ({ locale() { return this; }, fromNow: () => "now" }),
        connectedStatus: "connected", electron: { shell: { openPath() {} } },
        fs: { readFileSync: () => Buffer.from(""), writeFileSync() {} }, path,
        Hint: EmptyComponent,
        ...overrides
    });
}

test("Providers page: extracted component renders and loads only supported providers", async () => {
    const api = {
        getProxyProviders: async () => ({ status: 200, data: { providers: {
            remote: { name: "remote", vehicleType: "HTTP", proxies: [] },
            compatible: { name: "compatible", vehicleType: "Compatible", proxies: [] }
        } } }),
        getRuleProviders: async () => ({ status: 200, data: { providers: {
            rules: { name: "rules", vehicleType: "File", ruleCount: 2 }
        } } })
    };
    const store = new Vuex.Store({
        state: { app: { clashPath: "profile", clashStatus: "connected", profileRefreshTimes: 0, currentProfilePayload: {}, settings: {} } },
        getters: { clashAxiosClient: () => ({}) }
    });
    const Component = Vue.extend({ mixins: [{ computed: { clashApi: () => api } }, createPage()] });
    const vm = new Component({ store });
    await vm.fetchData();
    assert.deepEqual(vm.providers.map(value => value.name), ["remote"]);
    assert.deepEqual(vm.ruleProviders.map(value => value.name), ["rules"]);
    assert.equal(vm._render().data.staticClass, "main-provider-view");
    assert.equal(vm.$options._scopeId, "data-v-3e34584d");
    vm.$destroy();
});

test("Providers page: update failure and cancellation preserve provider state contracts", async () => {
    const page = createPage();
    const calls = [];
    const context = {
        providers: [{ name: "one", vehicleType: "HTTP", isUpdating: false, message: "" }],
        ruleProviders: [], updateAbortCtl: new AbortController(), healthCheckAbortCtl: new AbortController(),
        clashApi: { updateProxyProvider: async () => ({ status: 500, data: {} }) },
        $set(array, index, value) { array[index] = value; calls.push(value); },
        fetchSingleData: page.methods.fetchSingleData
    };
    await page.methods.handleProviderUpdate.call(context, 0);
    assert.equal(calls.at(-1).isUpdating, false);
    assert.equal(calls.at(-1).message, "couldNotUpdateProvider");

    let aborted = 0;
    context.updateAbortCtl = { abort: () => aborted++ };
    Object.defineProperty(context, "updatingProvidersCount", { value: 1 });
    page.methods.handleAllProvidersUpdate.call(context);
    assert.equal(aborted, 1);
});

test("Providers page: production entry delegates to the named factory", () => {
    assertRendererComposition("createProvidersPage", [
        "handleAllProvidersUpdate: function", "handleRuleProviderUpdate: function"
    ]);
});
