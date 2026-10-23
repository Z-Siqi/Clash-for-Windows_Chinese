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

    vm.localAddress = "192.168.7.12";
    vm.computeFromLocalAddress(vm.localAddress);
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

test("Router configuration derives broadcast from the submitted address/mask without resetting manual fields", () => {
    const Config = Vue.extend(createPage().components.ConfigView);
    for (const [localAddress, netmask, broadcast] of [
        ["10.7.8.2", "255.255.0.0", "10.7.255.255"],
        ["10.7.8.2", "255.255.254.0", "10.7.9.255"],
        ["10.7.8.2", "255.255.255.128", "10.7.8.127"],
        ["10.7.8.5", "255.255.255.252", "10.7.8.7"],
        ["10.7.8.2", "255.0.255.0", ""]
    ]) {
        const vm = new Config();
        vm.computeFromLocalAddress("192.168.7.2");
        Object.assign(vm, { localAddress, netmask, rangeFrom: "10.7.8.10", rangeTo: "10.7.8.20", defaultRouter: "10.7.8.1", primaryDns: "192.0.2.53" });
        let request; vm.$on("confirm", value => { request = value; });
        vm.handleContinueClick();
        assert.equal(request.broadAddress, broadcast);
        assert.equal(request.rangeFrom, "10.7.8.10"); assert.equal(request.rangeTo, "10.7.8.20");
        assert.equal(request.defaultRouter, "10.7.8.1"); assert.equal(request.primaryDns, "192.0.2.53");
        vm.$destroy();
    }
});

test("Router policy buttons preserve explicit client IDs and recover legacy null entries using MAC fallback", async () => {
    const store = new Vuex.Store({ state: { app: { routerHijackMacAddresses: [null, "legacy-client"], currentProfilePayload: {} } },
        mutations: { SET_ROUTER_HIJACK_MAC_ADDRESSES(state, { addresses }) { state.app.routerHijackMacAddresses = addresses; } } });
    const requests = [];
    const vm = new (Vue.extend(createPage({ dhcpService: { updatePolicy: async request => requests.push(request) } })))({ store });
    vm.server = true;
    const nodes = node => !node ? [] : [node, ...(node.children || []).flatMap(nodes)];
    for (const [options, expected] of [[{}, "00-11-22-33-44-55"], [{ 61: "explicit-client" }, "explicit-client"]]) {
        vm.clients = [{ chaddr: "00-11-22-33-44-55", options }];
        const button = nodes(vm._render()).find(node => node.data?.staticClass === "btn hijack-button");
        button.data.on.click(); await Vue.nextTick();
        assert.ok(requests.at(-1).hijackAddresses.includes(expected));
        assert.ok(requests.at(-1).hijackAddresses.includes("legacy-client"));
        assert.equal(requests.at(-1).hijackAddresses.includes(null), false);
        button.data.on.click(); await Vue.nextTick();
        assert.equal(requests.at(-1).hijackAddresses.includes(expected), false);
    }
    vm.$destroy();
});

test("Router long client selections do not guess legacy prefixes, alter short selections or merge identical display prefixes", async () => {
    const prefix = "x".repeat(128), token = "a".repeat(64), other = "b".repeat(64);
    const store = new Vuex.Store({ state: { app: { routerHijackMacAddresses: [prefix, "legacy-client"], routerHijackIdentityTokens: [], currentProfilePayload: {} } },
        mutations: { SET_ROUTER_HIJACK_IDENTITY_TOKENS(state, { tokens }) { state.app.routerHijackIdentityTokens = tokens; },
            SET_ROUTER_HIJACK_MAC_ADDRESSES(state, { addresses }) { state.app.routerHijackMacAddresses = addresses; } } });
    const requests = [];
    let onEvent;
    const vm = new (Vue.extend(createPage({ dhcpService: { start: async (_request, callback) => { onEvent = callback; }, updatePolicy: async request => requests.push(request) } })))({ store });
    await vm.handleConfigConfirm({});
    const client = { chaddr: "long-mac", options: { 61: prefix }, policyIdentity: { kind: "sha256", value: token } };
    onEvent("message", client);
    assert.equal(vm.needsIdentityReselect(client), true);
    assert.equal(vm.isClientHijacked(client), false);
    vm.handleClientHijack(client); await Vue.nextTick();
    assert.deepEqual(requests.at(-1).hijackIdentityTokens, [token]);
    assert.deepEqual(requests.at(-1).hijackAddresses, [prefix, "legacy-client"]);
    assert.equal(vm.needsIdentityReselect(client), false);
    assert.equal(vm.isClientHijacked({ ...client, policyIdentity: { kind: "sha256", value: other } }), false);
    assert.equal(vm.isClientHijacked({ chaddr: "fallback-mac", options: {}, policyIdentity: { kind: "raw", value: "legacy-client" } }), true);
    onEvent("message", { ...client, policyIdentity: { kind: "sha256", value: other } });
    assert.equal(vm.clients.length, 1);
    assert.equal(vm.clients[0].policyIdentity.value, other);
    assert.equal(vm.isClientHijacked(vm.clients[0]), false);
    vm.handleClientHijack(client); await Vue.nextTick();
    assert.deepEqual(requests.at(-1).hijackIdentityTokens, []);
    assert.deepEqual(Array.from(store.state.app.routerHijackMacAddresses), [prefix, "legacy-client"]);
    vm.$destroy();
});

test("Router selection limits cover raw and hashed identities without publishing a rejected addition", async () => {
    const addresses = Array.from({ length: 2048 }, (_value, index) => `client-${index}`);
    const store = new Vuex.Store({ state: { app: { routerHijackMacAddresses: addresses, routerHijackIdentityTokens: [], currentProfilePayload: {} } },
        mutations: { SET_ROUTER_HIJACK_IDENTITY_TOKENS(state, { tokens }) { state.app.routerHijackIdentityTokens = tokens; },
            SET_ROUTER_HIJACK_MAC_ADDRESSES(state, { addresses: next }) { state.app.routerHijackMacAddresses = next; } } });
    const vm = new (Vue.extend(createPage()))({ store });
    let notices = 0; vm.$alert = async () => { notices++; };
    const client = { chaddr: "long", options: {}, policyIdentity: { kind: "sha256", value: "a".repeat(64) } };
    assert.equal(vm.handleClientHijack(client), false);
    assert.equal(vm.handleMacToHijack("extra-client"), false);
    assert.equal(vm.routerHijackIdentityTokens.length, 0);
    assert.equal(vm.routerHijackMacAddresses.length, 2048);
    assert.equal(notices, 2);
    vm.handleMacToHijack("client-0");
    vm.handleClientHijack(client);
    assert.equal(vm.routerHijackIdentityTokens.length, 1);
    vm.$destroy();
});
