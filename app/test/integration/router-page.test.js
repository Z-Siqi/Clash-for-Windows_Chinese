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
        dhcpService: { async start() { throw new Error("unexpected DHCP server"); }, async stop() {} },
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

test("Router page: named DHCP client preserves events and sends current hijack policy", async () => {
    let onEvent;
    const requests = [];
    const page = createPage({
        dhcpService: {
            async start(request, callback) { requests.push(request); onEvent = callback; },
            async stop() { requests.push("stop"); },
            async updatePolicy(request) { requests.push(request); }
        }
    });
    const context = {
        isShowConfigView: true,
        server: null,
        clients: [],
        boundState: {},
        routerHijackMacAddresses: ["client-hijacked"],
        currentProfilePayload: { tun: { "dns-hijack": ["10.0.0.53", "10.0.0.54"] } }
    };
    context.dhcpPolicy = page.methods.dhcpPolicy.bind(context);

    await page.methods.handleConfigConfirm.call(context, {
        rangeFrom: "10.0.0.100", rangeTo: "10.0.0.200", netmask: "255.255.255.0",
        defaultRouter: "10.0.0.1", broadAddress: "10.0.0.255", localAddress: "10.0.0.2",
        primaryDns: "8.8.8.8", secondlyDns: "1.1.1.1"
    });

    assert.deepEqual(requests[0].hijackAddresses, ["client-hijacked"]);
    assert.deepEqual(requests[0].hijackDns, ["10.0.0.53", "10.0.0.54"]);
    onEvent("message", { chaddr: "mac", options: {} });
    onEvent("message", { chaddr: "mac", options: {} });
    onEvent("bound", { mac: { address: "10.0.0.101" } });

    assert.equal(context.isShowConfigView, false);
    assert.equal(context.clients.length, 1);
    assert.equal(context.boundState.mac.address, "10.0.0.101");
    assert.equal(context.server, true);
    context.serverRunning = true;
    context.routerHijackMacAddresses = [];
    page.methods.updateDhcpPolicy.call(context);
    assert.deepEqual(requests.at(-1).hijackAddresses, []);
    await page.methods.handleStartDHCPServer.call(context);
    assert.equal(requests.at(-1), "stop");
    assert.equal(context.server, null);
});

test("Router page: production entry delegates to the named factory", () => {
    assertRendererComposition("createRouterPage", [
        'name: "RouterConfigView"', "handleConfigConfirm: function"
    ]);
});
