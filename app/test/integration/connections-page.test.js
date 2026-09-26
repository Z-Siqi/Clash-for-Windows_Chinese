"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Vuex = require("../../main/node_modules/vuex");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createConnectionsPage } = require("../../main/dist/electron/features/connections/page");
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
    const context = {
        data: { connections: [first, second] }, lastData: { connections: [] },
        labelSelected: 3, reverseTags: [], searchText: "", searchTextReg: null
    };
    const ordered = page.computed.orderedConnections.call(context);
    assert.deepEqual(ordered.map(value => value.id), ["b", "a"]);
    assert.equal(page.methods.traffic(1536), "1.50 KB");
    assert.equal(page.methods.calcSpeedText.call({ traffic: page.methods.traffic }, { speed: { upload: 1024, download: 0 } }), "↑1.00 KB/s");
    assert.equal(page._scopeId, "data-v-39b270f2");
    assert.equal(page.components.ConnectionInfoView._scopeId, "data-v-947c6bac");
});

test("Connections page: stream lifecycle normalizes snapshots and closes the socket", () => {
    let messageHandler;
    let terminated = 0;
    const client = { on(name, callback) { if (name === "message") messageHandler = callback; }, terminate() { terminated++; } };
    const page = createPage({ normalizeConnectionsSnapshot: value => ({ ...value, normalized: true }) });
    const context = { clashWSClient: () => client, client: null, data: { connections: [] }, lastData: null };
    page.methods.openStream.call(context);
    messageHandler(JSON.stringify({ connections: [] }));
    assert.equal(context.data.normalized, true);
    page.methods.closeStream.call(context);
    assert.equal(terminated, 1);
    assert.equal(context.client, null);
});

test("Connections page: production entry delegates to the named factory", () => {
    assertRendererComposition("createConnectionsPage", [
        'name: "ConnectionInfoView"', "openStream()", "orderedConnections()"
    ]);
});
