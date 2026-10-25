"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createAlert } = require("../../main/dist/electron/features/renderer-ui/components/alert");
const { createInput } = require("../../main/dist/electron/features/renderer-ui/components/input");
const { createSelect } = require("../../main/dist/electron/features/renderer-ui/components/select");
const { createDns } = require("../../main/dist/electron/features/renderer-ui/components/dns");
const { createProfileEditor } = require("../../main/dist/electron/features/profiles/profile-editor-page");
const { createRouterPage } = require("../../main/dist/electron/features/router/page");
const { rendererComponents } = require("../fixtures/renderer-components");

Vue.use(Vuex);
const Empty = { render: h => h("span") };
function text(node) { return !node ? "" : (node.text || "") + (node.children || node.componentOptions?.children || []).map(text).join(""); }
function placeholders(node) {
    return !node ? [] : [node.data?.attrs?.placeholder, ...(node.children || node.componentOptions?.children || []).flatMap(placeholders)].filter(Boolean);
}
function hints(node) {
    return !node ? [] : [node.data?.attrs?.hint || node.componentOptions?.propsData?.hint, ...(node.children || node.componentOptions?.children || []).flatMap(hints)].filter(Boolean);
}
function fixture() {
    const selection = Vue.observable({ language: 0 });
    const labels = createTranslator(() => selection.language);
    const store = new Vuex.Store({ state: { app: {} }, getters: { theme: () => "dark" } });
    const common = { Vuex, getLanguage: () => labels, escCaptureComponent: Empty, selectViewComponent: Empty };
    return { selection, labels, store, common, instantiate: component => new (Vue.extend(component))({ store }) };
}

test("shared dialogs localize implicit titles, required validation, cancellation and DNS record headings", async () => {
    const { selection, labels, common, instantiate } = fixture();
    const alert = instantiate(createAlert(common)), input = instantiate(createInput(common));
    const select = instantiate(createSelect(common)), dns = instantiate(createDns(common));
    const alertResult = alert.show({ content: "diagnostic" });
    dns.isShow = true; dns.status = "NOERROR";
    dns.answers = [{ name: "example.test", type: 1, TTL: 60, data: "127.0.0.1" }];
    dns.additionals = [{ name: "example.test", type: 28, TTL: 60, data: "::1" }];
    input.data = [{ required: true, value: "", name: "draft", key: "draft" }];
    for (const language of [0, 1, 0]) {
        selection.language = language;
        await Vue.nextTick();
        assert.ok(text(alert._render()).includes(labels.error()));
        input.handleDone();
        assert.equal(input.error, labels.requiredFieldMissing());
        const result = select.show({ items: [labels.ok(), labels.cancel()] });
        assert.equal(select.title, labels.select());
        assert.equal(select.isLastDifferent, true);
        select.handleItemSelect(0);
        await result;
        const rendered = text(dns._render());
        assert.ok(rendered.includes(labels.dnsAnswer()));
        assert.ok(rendered.includes(labels.dnsAdditional()));
        assert.ok(rendered.includes("127.0.0.1"));
    }
    alert.handleDone(); await alertResult;
    const custom = alert.show({ title: "custom", content: "draft" });
    assert.ok(text(alert._render()).includes("custom"));
    alert.handleDone(); await custom;
    for (const vm of [alert, input, select, dns]) vm.$destroy();
});

test("proxy and DHCP editor dialogs translate complete forms while retaining protocol values and unsaved fields", async () => {
    const { selection, labels, common, instantiate } = fixture();
    const profile = createProfileEditor({ defineComponent, Vuex, getLanguage: common.getLanguage });
    const proxy = instantiate(profile.components.AppendProxyView);
    const router = instantiate(createRouterPage({ defineComponent, Vuex, getLanguage: common.getLanguage, getNetworkInterfaces: async () => [] }).components.ConfigView);
    proxy.proxyName = "draft"; router.rangeFrom = "192.168.1.100";
    for (const language of [0, 1, 0]) {
        selection.language = language;
        await Vue.nextTick();
        proxy.type = 0;
        proxy.groupType = "url-test";
        assert.ok(text(proxy._render()).includes(labels.newProxyGroupTitle()));
        assert.ok(placeholders(proxy._render()).includes(labels.proxyGroupName()));
        assert.ok(placeholders(proxy._render()).includes(labels.intervalSeconds()));
        proxy.type = 1; proxy.proxyType = "anytls";
        assert.ok(text(proxy._render()).includes(labels.newProxyTitle()));
        for (const key of ["password", "clientFingerprintPlaceholder", "alpnPlaceholder", "idleSessionCheckInterval", "idleSessionTimeout", "minimumIdleSessions"]) {
            assert.ok(placeholders(proxy._render()).includes(labels[key]()));
        }
        proxy.data = { name: "existing" };
        assert.ok(text(proxy._render()).includes(labels.editProxyTitle()));
        proxy.type = 0;
        assert.ok(text(proxy._render()).includes(labels.editProxyGroupTitle()));
        proxy.data = null;
        const rendered = text(router._render());
        for (const key of ["interfaceName", "dhcpIPRange", "rangeFrom", "rangeTo", "subnetMask", "defaultGateway", "primaryDNS", "alternativeDNS", "continueAction"]) {
            assert.ok(rendered.includes(labels[key]()), key);
        }
        assert.equal(proxy.proxyName, "draft");
        assert.equal(router.rangeFrom, "192.168.1.100");
        assert.ok(proxy.pType.includes("anytls"));
    }
    proxy.$destroy(); router.$destroy();
});

test("script and Diff editors translate their hints and script result without altering the returned value", async () => {
    const { instantiate } = fixture();
    for (const locale of [0, 1]) {
        const labels = createTranslator(locale), dialogs = [];
        const components = rendererComponents({ locale, overrides: { utilities: { showMessageBox: options => dialogs.push(options) } } });
        const script = instantiate(components["script-editor"]), diff = instantiate(components["diff-editor"]);
        script.isShow = true; script.isLoading = true; diff.isShow = true;
        assert.ok(hints(script._render()).includes(labels.pleaseWait()));
        assert.ok(hints(diff._render()).includes(labels.sideBySideMode()));
        script.editorCode = { getValue: () => "script", dispose() {} };
        script.resolve = () => {};
        script.clashApi = { runScript: async () => ({ data: { result: "DIRECT" } }) };
        script.isLoading = false;
        await script.test();
        assert.equal(dialogs.at(-1).message, labels.scriptTestResult({ result: "DIRECT" }));
        script.$destroy(); diff.$destroy();
    }
});
