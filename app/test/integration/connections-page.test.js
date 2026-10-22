"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Vuex = require("../../main/node_modules/vuex");
const Vue = require("../../main/node_modules/vue");
Vue.use(Vuex);
const { largeConnections } = require("../fixtures/large-connections");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createConnectionsPage } = require("../../main/dist/electron/features/connections/page");
const { createConnectionModel } = require("../../main/dist/electron/features/connections/connection-model");
const { assertRendererComposition } = require("../fixtures/assert-renderer-composition");

const EmptyComponent = { render: h => h("span") };
const labels = new Proxy({ locale: () => "en" }, { get: (target, key) => target[key] || (() => String(key)) });

function createPage(overrides = {}) {
    return createConnectionsPage({
        defineComponent,
        asyncToGenerator: require("../../main/node_modules/@babel/runtime/helpers/asyncToGenerator"),
        toConsumableArray: require("../../main/node_modules/@babel/runtime/helpers/toConsumableArray"),
        defineProperty: require("../../main/node_modules/@babel/runtime/helpers/defineProperty"),
        regenerator: require("../../main/node_modules/@babel/runtime/regenerator"),
        Hint: EmptyComponent, EscCapture: EmptyComponent,
        cache: { get: () => null, put() {} }, keys: {},
        moment: () => ({ format: () => "now", locale() { return this; }, fromNow: () => "now" }),
        Vuex, connectedStatus: "connected", path,
        formatBytes: value => `${value} B`, flattenValues: value => JSON.stringify(value),
        notify() {}, clipboard: { writeText() {} }, getLanguage: () => labels,
        getLanguageIndex: () => 1, normalizeConnectionsSnapshot: value => value,
        ...overrides
    });
}

test("Connections page: extracted owner sorts, filters and formats connection data", () => {
    const page = createPage();
    const first = { id: "a", start: "2026-01-01", upload: 20, download: 10, metadata: { host: "a", destinationIP: "1", network: "tcp" }, chains: [] };
    const second = { id: "b", start: "2026-01-02", upload: 5, download: 50, metadata: { host: "b", destinationIP: "2", network: "tcp" }, chains: [] };
    const model = createConnectionModel();
    model.ingest({ connections: [first, second] });
    const ordered = page.computed.orderedConnections.call({ data: model.view({ sort: 3 }) });
    assert.deepEqual(ordered.map(value => value.id), ["b", "a"]);
    assert.equal(page.methods.traffic(1536), "1.50 KB");
    assert.equal(page.methods.calcSpeedText.call({ traffic: page.methods.traffic }, { speed: { upload: 1024, download: 0 } }), "↑1.00 KB/s");
    assert.equal(page._scopeId, "data-v-39b270f2");
    assert.equal(page.components.ConnectionInfoView._scopeId, "data-v-947c6bac");
});

test("Connections page: stream lifecycle delegates raw snapshots and ignores retired sockets", () => {
    let messageHandler;
    let terminated = 0;
    const client = { on(name, callback) { if (name === "message") messageHandler = callback; }, terminate() { terminated++; } };
    const page = createPage({ normalizeConnectionsSnapshot: value => ({ ...value, normalized: true }) });
    const received = [];
    const context = { clashWSClient: () => client, client: null, updateView: value => received.push(value) };
    page.methods.openStream.call(context);
    messageHandler(JSON.stringify({ connections: [] }));
    assert.deepEqual(received, ['{"connections":[]}']);
    page.methods.closeStream.call(context);
    assert.equal(terminated, 1);
    assert.equal(context.client, null);
    messageHandler("obsolete");
    assert.equal(received.length, 1);
});

test("Connections page: unfiltered Close All uses one semantic API request", async () => {
    let calls = 0;
    await createPage().methods.handleCloseAllConnections.call({ searchText: "", closingConnections: false,
        clashApi: { closeConnections: async () => calls++ } });
    assert.equal(calls, 1);
});

test("Connections page: filtered Close All covers offscreen matches with bounded request concurrency", async t => {
    const model = createConnectionModel();
    const worker = {
        postMessage(message) {
            queueMicrotask(() => {
                if (message.payload !== undefined) model.ingest(JSON.parse(message.payload));
                if (message.operation === "beginClose") model.beginClose(message.query);
                worker.onmessage({ data: { id: message.id, ...(message.operation === "closeBatch"
                    ? { batch: model.closeBatch() } : { view: model.view(message.query) }) } });
            });
        }, terminate() {}
    };
    const vm = new Vue({ ...createPage({ createWorker: () => worker }),
        store: new Vuex.Store({ state: { app: { clashStatus: "connected" } } }) });
    t.after(() => vm.$destroy());
    let concurrent = 0, maximum = 0;
    const closed = [];
    Object.defineProperty(vm, "clashApi", { value: { async closeConnection(id) {
        concurrent++; maximum = Math.max(maximum, concurrent);
        await new Promise(resolve => setImmediate(resolve));
        closed.push(id); concurrent--;
    } } });
    vm.isActive = true;
    vm.searchText = "network=udp";
    vm.updateView(JSON.stringify({ connections: largeConnections(1000) }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(vm.data.count, 500);
    assert.ok(vm.orderedConnections.length < 30);
    await vm.handleCloseAllConnections();
    assert.equal(closed.length, 500);
    assert.ok(closed.includes("connection-999"));
    assert.ok(closed.every(id => Number(id.split("-")[1]) % 2 === 1));
    assert.ok(maximum <= 16);
});

test("Connections page: production entry delegates to the named factory", () => {
    assertRendererComposition("createConnectionsPage", [
        'name: "ConnectionInfoView"', "openStream()", "orderedConnections()"
    ]);
});
