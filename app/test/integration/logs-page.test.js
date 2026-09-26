"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createLogsPage } = require("../../main/dist/electron/features/logs/page");
const { assertRendererComposition } = require("../fixtures/assert-renderer-composition");

Vue.use(Vuex);
const labels = new Proxy({}, { get: (_target, key) => () => String(key) });
const SelectView = { render: h => h("span") };

function createPage(overrides = {}) {
    return createLogsPage({
        defineComponent, Vuex, getLanguage: () => labels,
        moment: () => ({ format: () => "12:34:56" }),
        flattenValues: value => JSON.stringify(value), notify() {}, uniqueId: (() => { let id = 0; return () => String(++id); })(),
        connectedStatus: "connected", clipboard: { writeText() {} },
        readLastLines: { read: async () => "" }, cache: { get: () => null, put() {} },
        keys: { LOG_MOUDLE_LEVEL: "level", LOG_MODULE_STYLE: "style", LOG_MODULE_SEARCH_TEXT: "search" },
        SelectView, normalizeStructuredLog: value => value, parseCoreLogLine: () => null,
        ...overrides
    });
}

test("Logs page: extracted owner parses, filters and renders structured logs", () => {
    const store = new Vuex.Store({
        state: { app: { isWindowShow: true, clashStatus: "connected", mode: "rule", logFilePath: "", settings: {} } },
        getters: { clashWSClient: () => () => null }, actions: { getMode() {} }
    });
    const Component = Vue.extend({ mixins: [{ computed: { theme: () => "dark" } }, createPage()] });
    const vm = new Component({ store });
    vm.parseLog({ level: "info", message: "accepted", fields: [{ key: "rAddr", value: "example:443" }] });
    vm.searchText = "accepted";
    assert.equal(vm.logList.length, 1);
    assert.equal(vm.addrFieldStr(vm.logList[0]), "example:443");
    assert.equal(vm._render().data.staticClass, "main-log-view w-full");
    assert.equal(vm.$options._scopeId, "data-v-6acd51f2");
    vm.$destroy();
});

test("Logs page: stream lifecycle normalizes messages and terminates the active client", () => {
    let messageHandler;
    let terminated = 0;
    const client = { readyState: 1, on(name, callback) { if (name === "message") messageHandler = callback; }, terminate() { terminated++; } };
    const page = createPage();
    const parsed = [];
    const context = {
        logLevel: 0, client: null, clashWSClient: () => client,
        parseLog: value => parsed.push(value), closeLogStream: page.methods.closeLogStream
    };
    page.methods.openLogStream.call(context);
    messageHandler(JSON.stringify({ level: "info", message: "ok", fields: [] }));
    page.methods.closeLogStream.call(context);
    assert.equal(parsed[0].message, "ok");
    assert.equal(terminated, 1);
    assert.equal(context.client, null);
});

test("Logs page: production entry delegates to the named factory", () => {
    assertRendererComposition("createLogsPage", [
        "openLogStream: function", "parseStringLog: function", "handleWindwEvent: function"
    ]);
});
