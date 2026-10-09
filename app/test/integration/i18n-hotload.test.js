"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const Router = require("../../main/node_modules/vue-router");
const yaml = require("../../main/node_modules/yaml");
const { buildStore } = require("../fixtures/renderer-store");
const { homePage } = require("../fixtures/home-page");
const { createRendererLanguage } = require("../../main/dist/electron/entry/renderer/language-runtime");
const { createGlobalMixin } = require("../../main/dist/electron/entry/renderer/global-mixin");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createInput } = require("../../main/dist/electron/features/renderer-ui/components/input");
const { createProfileEditor } = require("../../main/dist/electron/features/profiles/profile-editor-page");
const { createConnectionsPage } = require("../../main/dist/electron/features/connections/page");

function fixture(t, options = {}) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-i18n-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const state = buildStore({ home, ...options });
    const runtime = createRendererLanguage({ ...state,
        ipcRenderer: { invoke: async (...args) => state.ipcCalls.push(args) } });
    return { ...state, ...runtime };
}

test("fresh renderer follows system language without saving an implicit preference", async t => {
    for (const [systemLanguage, expected] of [["zh-TW", "设置"], ["en-GB", "Settings"], ["fr-FR", "Settings"]]) {
        const state = fixture(t, { systemLanguage });
        assert.equal(state.getLanguage().t("settings"), expected);
        assert.equal(state.cache.get("language"), null);
        assert.equal(state.store.state.app.settings.language, undefined);
        await state.setLanguageIndex(0);
        const restarted = buildStore({ home: state.store.state.app.clashPath, storage: state.storage, systemLanguage: "en-US" });
        assert.equal(restarted.modifyState.language, 0);
    }
});

function textOf(node) {
    if (!node) return "";
    return (node.text || "") + (node.children || node.componentOptions?.children || []).map(textOf).join("");
}

test("real Vue updates the sidebar in place and preserves routes, drafts and both legacy menu orders", async t => {
    Vue.use(Router);
    for (const order of [["Settings", "Profiles", "General"], ["设置", "配置", "主页"]]) {
        const state = fixture(t);
        state.cache.put(state.keys.MENU_ITEM_ORDER, order);
        state.store.commit("SET_MENU_ITEMS", { items: [...state.store.state.app.menuItems,
            { path: "/home/provider" }, { path: "/home/router" }] });
        const page = homePage({ getLanguage: state.getLanguage, cache: state.cache, keys: state.keys });
        const router = new Router({ routes: [{ path: "/home/setting" }] });
        await router.push("/home/setting");
        const vm = new (Vue.extend(page.components.MainMenu))({ store: state.store, router,
            propsData: { profileUpdateFailedURLs: [] } });
        t.after(() => vm.$destroy());
        vm.isAllowSort = true;
        const snapshots = [];
        vm.$watch(() => textOf(vm._render()), value => snapshots.push(value), { immediate: true });
        assert.match(snapshots.at(-1), /设置/);
        const originalPaths = vm.tabs.map(item => item.path);
        assert.deepEqual(originalPaths.slice(0, 3), ["/home/setting", "/home/server", "/home/general"]);
        const selectedIndex = vm.selectedIdx;

        // The same instance continues rendering after each switch; no remount is requested.
        await state.setLanguageIndex(1);
        await Vue.nextTick();
        assert.match(snapshots.at(-1), /Settings/);
        assert.match(snapshots.at(-1), /Providers/);
        assert.match(snapshots.at(-1), /Router/);
        assert.deepEqual(vm.tabs.map(item => item.path), originalPaths);
        assert.equal(vm.selectedIdx, selectedIndex);
        assert.equal(router.currentRoute.path, "/home/setting");
        assert.equal(vm.isAllowSort, true);

        // Reordering now persists route IDs and remains stable when switching back.
        vm.tabs = [...vm.tabs].reverse();
        const savedPaths = state.cache.get(state.keys.MENU_ITEM_ORDER);
        assert.deepEqual(savedPaths, [...originalPaths].reverse());
        await state.setLanguageIndex(0);
        await Vue.nextTick();
        assert.match(snapshots.at(-1), /设置/);
        assert.match(snapshots.at(-1), /提供/);
        assert.deepEqual(vm.tabs.map(item => item.path), savedPaths);
        assert.ok(state.ipcCalls.every(call => call[0] === "cfw-language"));
    }
});

test("loading a profile language applies it before startup without reloading the renderer", async t => {
    const state = fixture(t);
    const mixin = createGlobalMixin({ Vuex, modifyState: state.modifyState, setLanguageIndex: state.setLanguageIndex,
        settingsRepository: { load(_home, onLanguage) { onLanguage(1); return { language: 1 }; } } });
    mixin.methods.loadSettings.call({ clashPath: "temporary", setSettingsObject: value => state.store.commit("SET_SETTINGS_OBJECT", value) });
    await Vue.nextTick();
    assert.equal(state.getLanguage().t("settings"), "Settings");
    assert.equal(state.cache.get("language"), 1);
    assert.equal(state.store.state.app.settings.language, 1);
    assert.ok(state.ipcCalls.every(call => call[0] === "cfw-language"));
});

test("cached connection filters and profile save buttons follow language changes without losing edits", async t => {
    const state = fixture(t);
    const writes = [];
    const profile = createProfileEditor({ defineComponent, Vuex, getLanguage: state.getLanguage, path, yaml,
        profileFiles: { writeProfile: async (...args) => writes.push(args) } });
    const editor = new (Vue.extend(profile))({ store: state.store, propsData: { profileName: "draft.yml" } });
    const connections = new (Vue.extend(createConnectionsPage({ defineComponent, Vuex,
        getLanguage: state.getLanguage, cache: state.cache, keys: state.keys })))({ store: state.store });
    t.after(() => { editor.$destroy(); connections.$destroy(); });
    editor.conf = { rules: ["MATCH,DIRECT"] };
    editor.addData = { name: "unsaved proxy" };
    connections.searchText = "network=tcp";
    const originalFilters = connections.filterTypes.map(item => item.key);
    assert.equal(editor.saveBtn, "保存");
    assert.equal(connections.filterTypes[0].title, state.getLanguage().t("sourceIP"));
    await state.setLanguageIndex(1);
    await Vue.nextTick();
    assert.equal(editor.saveBtn, "Save");
    assert.equal(connections.filterTypes[0].title, "Source IP");
    assert.deepEqual(connections.filterTypes.map(item => item.key), originalFilters);
    assert.equal(connections.searchText, "network=tcp");
    assert.deepEqual(editor.conf.rules, ["MATCH,DIRECT"]);
    assert.equal(editor.addData.name, "unsaved proxy");
    await editor.saveData();
    assert.deepEqual(yaml.parse(writes[0][2]).rules, ["MATCH,DIRECT"]);
});

test("singleton input dialogs translate default buttons at render time and preserve custom text", async t => {
    const state = fixture(t);
    const input = new (Vue.extend(createInput({ Vuex, escCaptureComponent: { render: h => h("div") },
        getLanguage: state.getLanguage })))({ store: state.store });
    t.after(() => input.$destroy());
    input.isShow = true;
    input.data = [{ name: "Draft", key: "draft", value: "unsaved text" }];
    const snapshots = [];
    input.$watch(() => textOf(input._render()), value => snapshots.push(value), { immediate: true });
    assert.match(snapshots.at(-1), /确定/);
    await state.setLanguageIndex(1);
    await Vue.nextTick();
    assert.match(snapshots.at(-1), /OK/);
    assert.equal(input.data[0].value, "unsaved text");
    input.confirmText = "custom action";
    await state.setLanguageIndex(0);
    await Vue.nextTick();
    assert.match(snapshots.at(-1), /custom action/);
});
