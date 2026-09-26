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
