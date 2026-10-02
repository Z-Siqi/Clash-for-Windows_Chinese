"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const yaml = require("../../main/node_modules/yaml");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createSettingsPage } = require("../../main/dist/electron/features/settings/page");
const { assertRendererComposition } = require("../fixtures/assert-renderer-composition");

const EmptyComponent = { render: h => h("span") };
const labels = new Proxy({}, { get: (_target, key) => () => String(key) });

function createPage(overrides = {}) {
    return createSettingsPage({
        defineComponent,
        cache: { get: () => null, put() {} }, keys: {}, yaml,
        fs: { writeFileSync() {}, readFileSync: () => Buffer.from(""), existsSync: () => true },
        Vuex, SimpleInput: EmptyComponent, SelectView: EmptyComponent, SwitchView: EmptyComponent,
        draggable: EmptyComponent, Navigator: EmptyComponent, Hint: EmptyComponent,
        defaultBypass: [], defaultPac: "", getNetworkInterfaces: () => [],
        electron: { ipcRenderer: { invoke: async () => "tmp", send() {} }, clipboard: { writeText() {} }, shell: { openPath() {} } },
        path, childProcess: { exec: () => ({ on() {} }) }, uuid: { v4: () => "uuid" },
        isMacOS: () => false, isWindows: () => true, logger: { error() {}, warn() {} },
        showMessageBox: async () => ({ response: 0 }), updateYaml: async () => {},
        Info: EmptyComponent, getWlanInterfaces: () => [],
        getLanguage: () => labels, setLanguageIndex() {}, languageKey: "language",
        renderConnectionDisconnectSettings: () => [],
        ...overrides
    });
}

test("Settings navigator binds the scrolling action and default tray style exposes delay controls", () => {
    Vue.use(Vuex);
    const store = new Vuex.Store({ state: { app: { settings: {}, confData: {} } }, getters: { secret: () => "", clashAxiosClient: () => null } });
    const vm = new (Vue.extend(createPage()))({ store });
    vm.settings = {};
    vm.isLinux = false;
    vm.isMacOS = false;
    vm.isWindows = true;
    const nodes = [];
    function visit(node) {
        if (!node) return;
        nodes.push(node);
        for (const child of node.children || node.componentOptions?.children || []) visit(child);
    }
    visit(vm._render());
    const navigator = nodes.find(node => node.componentOptions?.tag === "navigator");
    assert.equal(navigator.componentOptions.listeners.select, vm.handleNavigateToGroup);
    assert.ok(nodes.some(node => node.text?.includes("showTrayProxyDelayIndicator")));
    const container = { children: [{ offsetTop: 150 }, { offsetTop: 950 }], scrollTop: 0 };
    createPage().methods.handleNavigateToGroup.call({ $refs: { "mixin-scroll-content": container }, $nextTick: callback => callback() }, 1);
    assert.equal(container.scrollTop, 840);
    vm.$destroy();
});

test("Settings page: extracted owner includes its local controls and production scope", () => {
    const page = createPage();
    assert.equal(page._scopeId, "data-v-fc0cd1de");
    assert.equal(page.components.Section._scopeId, "data-v-18adce47");
    assert.equal(page.components.KeyCapture._scopeId, "data-v-2ddf36e7");
    assert.equal(page.components.MoreHint._scopeId, "data-v-6a8f4af4");
    assert.equal(page.components.TrayOrder._scopeId, "data-v-40749f51");
});

test("Settings page: core selection changes only when needed and restarts through the parent", async () => {
    const messages = [];
    const page = createPage({ electron: { ipcRenderer: { send: (...args) => messages.push(args) } } });
    let restarts = 0, modes = [];
    const context = {
        settings: { proxyCore: "clash" },
        $set(target, key, value) { target[key] = value; },
        refreshCore: page.methods.refreshCore,
        $parent: {
            mode: "script",
            async switchMode(mode) { modes.push(mode); this.mode = mode; },
            async handlerRestartClash() { restarts++; }
        }
    };
    await page.methods.handleProxyCoreChange.call(context, 1);
    assert.equal(context.settings.proxyCore, "mihomo");
    assert.deepEqual(modes, ["rule"]);
    assert.deepEqual(messages, [["core-type-changed", "mihomo"]]);
    assert.equal(restarts, 1);
    await page.methods.handleProxyCoreChange.call(context, 1);
    assert.equal(restarts, 1);
});

test("Settings page: Script shortcut control follows the selected core", () => {
    const page = createPage();
    const visible = core => page.computed.scriptModeVisible.call({
        $store: { state: { app: { settings: { proxyCore: core } } } }
    });
    assert.equal(visible("clash"), true);
    assert.equal(visible("mihomo"), false);
});

test("Settings page: Enhanced Tray text asset is independent of routing Script mode", () => {
    const page = createPage();
    const TrayOrder = Vue.extend(page.components.TrayOrder);
    const list = new TrayOrder({ propsData: { arr: [["text"], ["status"]] } })._render();
    const pending = [list];
    let shownImage;
    while (pending.length && !shownImage) {
        const node = pending.shift();
        if (node?.data?.attrs?.src === "static/imgs/tray-text.png") shownImage = node;
        if (node?.children) pending.push(...node.children);
        if (node?.componentOptions?.children) pending.push(...node.componentOptions.children);
    }
    assert.ok(shownImage);
    assert.equal(shownImage.data.attrs.src, "static/imgs/tray-text.png");
    assert.equal(Object.hasOwn(page.components.TrayOrder.props, "proxyCore"), false);
});

test("Settings page opens only named native logs without renderer filesystem access", async () => {
    const kinds = [];
    const page = createPage({ openApplicationLog: async kind => kinds.push(kind) });
    await page.methods.handleOpenActionScriptsConsoleFile();
    await page.methods.handleOpenConsoleFile();
    await page.methods.handleOpenGUILog();
    assert.deepEqual(kinds, ["script", "parser", "gui"]);
});

test("Settings page: production entry delegates to the named factory", () => {
    assertRendererComposition("createSettingsPage", [
        "createSettingsPageComponents", "createSettingsPageOptions", "createSettingsPageRender"
    ]);
});
