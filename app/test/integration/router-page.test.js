"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createRouterPage } = require("../../main/dist/electron/features/router/page");
const { assertRendererComposition } = require("../fixtures/assert-renderer-composition");

Vue.use(Vuex);
const labels = new Proxy({}, { get: (_target, key) => () => String(key) });

function createPage(overrides = {}) {
    return createRouterPage({
        defineComponent,
        Vuex,
        getLanguage: () => labels,
        electron: { ipcRenderer: { invoke: async () => 1 } },
        cache: { get: () => ({}), put() {} },
        keys: { DHCP_MAC_ALIAS: "aliases" },
        dhcp: { createServer() { throw new Error("unexpected DHCP server"); } },
        getNetworkInterfaces: () => [],
        getHijackAddresses: () => [],
        ...overrides
    });
}

test("Router page: extracted configuration computes the subnet and emits the DHCP request", () => {
    const ConfigView = createPage().components.ConfigView;
    const vm = new (Vue.extend(ConfigView))();
    let request;
    vm.$on("confirm", value => { request = value; });

    vm.computeFromLocalAddress("192.168.7.12");
    vm.handleContinueClick();

    assert.equal(vm.rangeFrom, "192.168.7.100");
    assert.equal(vm.rangeTo, "192.168.7.200");
    assert.equal(vm.defaultRouter, "192.168.7.1");
    assert.equal(request.broadAddress, "192.168.7.255");
    assert.equal(vm.$options._scopeId, "data-v-0ffa25f2");
    vm.$destroy();
});

test("Router page: DHCP callbacks preserve hijack routing and lifecycle behavior", async () => {
    const handlers = {};
    const requests = [];
    const ipcCalls = [];
    const server = {
        on(name, callback) { handlers[name] = callback; return this; },
        listen() { requests.push("listen"); },
        close() { requests.push("close"); },
        address: () => ({ address: "127.0.0.1", port: 67 })
    };
    const page = createPage({
        dhcp: { createServer(options) { requests.push(options); return server; } },
        getHijackAddresses: () => ["client-hijacked"],
        electron: { ipcRenderer: { async invoke(...args) { ipcCalls.push(args); return 42; } } }
    });
    const context = {
        isShowConfigView: true,
        server: null,
        clients: [],
        boundState: {},
        powersaveBlockerID: 0,
        currentProfilePayload: { tun: { "dns-hijack": ["10.0.0.53", "10.0.0.54"] } }
    };

    page.methods.handleConfigConfirm.call(context, {
        rangeFrom: "10.0.0.100", rangeTo: "10.0.0.200", netmask: "255.255.255.0",
        defaultRouter: "10.0.0.1", broadcast: "10.0.0.255", localAddress: "10.0.0.2",
        primaryDns: "8.8.8.8", secondlyDns: "1.1.1.1"
    });

    const options = requests[0];
    assert.deepEqual(options.router({ clientId: "client-hijacked" }), ["10.0.0.2"]);
    assert.deepEqual(options.dns({ clientId: "client-hijacked" }), ["10.0.0.53", "10.0.0.54"]);
    assert.deepEqual(options.dns({ clientId: "normal" }), ["8.8.8.8", "1.1.1.1"]);
    handlers.message({ chaddr: "mac", options: {} });
    handlers.message({ chaddr: "mac", options: {} });
    handlers.bound({ mac: { address: "10.0.0.101" } });
    await handlers.listening();

    assert.equal(context.isShowConfigView, false);
    assert.equal(context.clients.length, 1);
    assert.equal(context.boundState.mac.address, "10.0.0.101");
    assert.equal(context.server, server);
    assert.equal(context.powersaveBlockerID, 42);
    assert.deepEqual(ipcCalls, [["powerSaveBlocker", "start", "prevent-app-suspension"]]);
});

test("Router page: production entry delegates to the named factory", () => {
    assertRendererComposition("createRouterPage", [
        'name: "RouterConfigView"', "handleConfigConfirm: function"
    ]);
});
