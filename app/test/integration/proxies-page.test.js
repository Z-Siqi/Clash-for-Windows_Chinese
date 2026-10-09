"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createProxiesPage } = require("../../main/dist/electron/features/proxies/page");
const { rendererPath } = require("../fixtures/renderer-harness");
const { assertRendererComposition } = require("../fixtures/assert-renderer-composition");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { createProvidersPage } = require("../../main/dist/electron/features/providers/page");
const { createAppMutations } = require("../../main/dist/electron/features/application-state/mutations");

const EmptyComponent = { render: h => h("span") };
const labels = new Proxy({}, { get: (_target, key) => () => key === "timeout" ? "Timeout" : String(key) });

function createPage(overrides = {}) {
    return createProxiesPage({
        defineComponent,
        Hint: EmptyComponent, Navigator: EmptyComponent, Vuex,
        CancelToken: class {}, cache: { get: () => null, put() {} }, keys: {},
        lodash: require("../../main/node_modules/lodash"),
        runUserScript: async value => value,
        cloneJson: value => JSON.parse(JSON.stringify(value)), proxyScriptType: "proxy",
        connectedStatus: "connected",
        scheduler: { add: () => "timer", stop() {} }, getLanguage: () => labels,
        ...overrides
    });
}

test("retained Proxies instances refresh after configuration apply and provider updates", async t => {
    Vue.use(Vuex);
    let node = "original";
    const api = {
        isReady: () => true,
        getProxies: async () => ({ data: { proxies: { Auto: { type: "Selector", all: [node], history: [] } } } }),
        getProxyProviders: async () => ({ data: { providers: {} } }),
        updateProxyProvider: async () => { node = "provider-updated"; return { status: 204 }; }
    };
    const store = new Vuex.Store({ modules: { app: {
        state: { profileRefreshTimes: 0, proxyRefreshTimes: 0, settings: {} },
        mutations: createAppMutations({ path, connectionStatus: {} })
    } }, getters: { clashAxiosClient: () => ({}) } });
    const vm = new (Vue.extend({ mixins: [createPage()], computed: {
        clashApi: () => api, settings: () => ({})
    } }))({ store });
    t.after(() => vm.$destroy());
    const flush = async () => { await Vue.nextTick(); await new Promise(resolve => setImmediate(resolve)); };
    await vm.fetchData();
    const uid = vm._uid;
    const visibleNode = () => vm.proxies[0].data.all[0].name;
    assert.equal(visibleNode(), "original");
    node = "subscription-updated";
    store.commit("ADD_PROFILE_REFRESH_TIMES", { times: 1 });
    await flush();
    assert.equal(visibleNode(), "subscription-updated");
    const providerPage = createProvidersPage({ defineComponent, Vuex, getLanguage: () => labels,
        onProxyProviderUpdated: () => store.commit("ADD_PROXY_REFRESH_TIMES", { times: 1 }) });
    const providers = { providers: [{ name: "remote", vehicleType: "HTTP" }],
        updateAbortCtl: new AbortController(), clashApi: api,
        $set: (array, index, value) => { array[index] = value; },
        fetchSingleData: async () => { throw Error("provider detail read failed"); } };
    await providerPage.methods.handleProviderUpdate.call(providers, 0);
    await flush();
    assert.equal(visibleNode(), "provider-updated");
    assert.equal(vm._uid, uid);
    api.updateProxyProvider = async () => ({ status: 500, data: {} });
    await providerPage.methods.handleProviderUpdate.call(providers, 0);
    assert.equal(store.state.app.proxyRefreshTimes, 1);
});

test("an older node fetch cannot overwrite a newer provider refresh", async () => {
    const page = createPage();
    let releaseOld;
    let calls = 0;
    const response = name => ({ data: { proxies: { Auto: { type: "Selector", all: [name], history: [] } } } });
    const context = { clashApi: {
        isReady: () => true,
        getProxies: () => ++calls === 1 ? new Promise(resolve => { releaseOld = resolve; }) : Promise.resolve(response("new")),
        getProxyProviders: async () => ({ data: { providers: {} } })
    }, findProvider: page.methods.findProvider, delayKeyName: "delay", testingProxyNames: [], settings: {}, proxies: [] };
    const old = page.methods.fetchData.call(context);
    await new Promise(resolve => setImmediate(resolve));
    await page.methods.fetchData.call(context);
    releaseOld(response("old"));
    await old;
    assert.equal(context.proxies[0].data.all[0].name, "new");
});

test("timed-out proxy labels follow the current language without refetching or changing node state", async () => {
    let language = 0;
    const translator = createTranslator(() => language);
    const page = createPage({ getLanguage: () => translator });
    const context = {
        clashApi: {
            isReady: () => true,
            getProxies: async () => ({ data: { proxies: {
                Auto: { type: "Selector", now: "node", all: ["node", "provider-node"], history: [] },
                node: { history: [{ delay: 0 }] }
            } } }),
            getProxyProviders: async () => ({ data: { providers: {
                fixture: { proxies: [{ name: "provider-node", history: [{ delay: 0 }] }] }
            } } })
        },
        findProvider: page.methods.findProvider,
        delayKeyName: "delay", testingProxyNames: [], settings: {}, proxies: []
    };
    await page.methods.fetchData.call(context);
    const nodes = context.proxies.find(group => group.name === "Auto").data.all;
    assert.deepEqual(nodes.map(node => node.latency), [0, 0]);
    for (const node of nodes) assert.equal(page.methods.checkBtnText(node), translator.t("timeout"));
    language = 1;
    for (const node of nodes) {
        assert.equal(page.methods.checkBtnText(node), "Timeout");
        assert.equal(node.latency, 0);
    }
    assert.equal(page.methods.checkBtnText({ latency: -1 }), "-- ms");
    assert.equal(page.methods.checkBtnText({ latency: "30 ms" }), "30 ms");
});

test("Proxies page: extracted owner builds proxy groups and provider-backed nodes", async () => {
    const page = createPage();
    const context = {
        clashApi: {
            isReady: () => true,
            getProxies: async () => ({ data: { proxies: {
                GLOBAL: { all: ["Auto"] }, Auto: { type: "Selector", now: "node", all: ["node"], history: [] }
            } } }),
            getProxyProviders: async () => ({ data: { providers: {
                provider: { proxies: [{ name: "node", history: [{ delay: 30 }], udp: true, alive: true }] }
            } } })
        },
        findProvider: page.methods.findProvider,
        delayKeyName: "delay", testingProxyNames: [], settings: { proxyOrder: 0 }, proxies: []
    };
    await page.methods.fetchData.call(context);
    const auto = context.proxies.find(group => group.name === "Auto");
    assert.equal(auto.data.all[0].name, "node");
    assert.equal(auto.data.all[0].latency, "30 ms");
    assert.equal(page._scopeId, "data-v-0729f95b");
    assert.equal(page.components.ProxyModeSwitcher._scopeId, "data-v-357c3e79");
});

test("Proxies page: extracted owner finds providers and preserves mode-switch cancellation", async () => {
    const page = createPage();
    const provider = { proxies: [{ name: "node" }] };
    assert.deepEqual(page.methods.findProvider({ provider }, "node"), [provider, provider.proxies[0]]);
    let cancelled = 0;
    let selected;
    await page.components.ProxyModeSwitcher.methods.switchMode.call({
        $parent: { cancelLatencyTest() { cancelled++; } }, $emit(_name, value) { selected = value; }
    }, "rule");
    assert.equal(cancelled, 1);
    assert.equal(selected, "rule");
});

test("Proxies page: Script mode control follows the selected core", () => {
    const page = createPage();
    const visible = core => page.computed.scriptModeVisible.call({
        $store: { state: { app: { settings: { proxyCore: core } } } }
    });
    assert.equal(visible("clash"), true);
    assert.equal(visible("mihomo"), false);
    assert.deepEqual(page.components.ProxyModeSwitcher.props, ["mode", "scriptModeVisible"]);

    const Switcher = Vue.extend(page.components.ProxyModeSwitcher);
    const clashButtons = new Switcher({
        propsData: { mode: "rule", scriptModeVisible: true }
    })._render().children[0];
    const mihomoButtons = new Switcher({
        propsData: { mode: "rule", scriptModeVisible: false }
    })._render().children[0];
    assert.equal(clashButtons.data.class.compact, false);
    assert.equal(mihomoButtons.data.class.compact, true);
    assert.equal(clashButtons.children.filter(child => child.componentOptions).length, 4);
    assert.equal(mihomoButtons.children.filter(child => child.componentOptions).length, 3);

    const styles = fs.readFileSync(path.join(path.dirname(rendererPath), "styles.css"), "utf8");
    assert.match(styles, /\.btns\.compact\[data-v-357c3e79\]\{max-width:500px;justify-content:center;gap:24px\}/);
    assert.match(styles, /\.btns\.compact \.btn\[data-v-357c3e79\]\{width:132px\}/);
});

test("Proxies page: production entry delegates to the named factory", () => {
    assertRendererComposition("createProxiesPage", [
        "async startLatencyTest", "async switchProxy", "findProvider("
    ]);
});
