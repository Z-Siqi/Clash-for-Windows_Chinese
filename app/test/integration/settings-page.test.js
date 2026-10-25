"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const yaml = require("../../main/node_modules/yaml");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createSettingsPage } = require("../../main/dist/electron/features/settings/page");
const { assertRendererComposition } = require("../fixtures/assert-renderer-composition");
const { createRendererLanguage } = require("../../main/dist/electron/entry/renderer/language-runtime");
const { createSettingsRepository } = require("../../main/dist/electron/features/settings/settings-repository");
const { createSettingsProxy } = require("../../main/dist/electron/features/settings/settings-proxy");
const { updateYamlValue } = require("../../main/dist/electron/core/storage/yaml-file");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

const EmptyComponent = { render: h => h("span") };
const labels = new Proxy({}, { get: (_target, key) => () => String(key) });

test("macOS keeps saved automatic-upgrade data without presenting an inactive updater switch", () => {
    Vue.use(Vuex);
    const vm = new (Vue.extend(createPage()))({ store: new Vuex.Store({ state: { app: { settings: {}, confData: {} } }, getters: { secret: () => "" } }) });
    vm.settings = { silentUpdate: true };
    vm.isMacOS = true; vm.isWindows = false; vm.isLinux = false;
    const nodes = node => !node ? [] : [node, ...(node.children || node.componentOptions?.children || []).flatMap(nodes)];
    assert.equal(nodes(vm._render()).some(node => node.data?.model?.expression === "settings.silentUpdate"), false);
    assert.ok(nodes(vm._render()).some(node => node.data?.model?.expression === "settings.checkForUpdates"));
    assert.equal(vm.settings.silentUpdate, true);
    vm.$destroy();
});

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

test("settings native file choices and Fake IP cache results use the selected language", async () => {
    let language = 0, status = 204;
    const labels = createTranslator(() => language), dialogs = [], choices = [];
    const page = createPage({ getLanguage: () => labels,
        showMessageBox: async options => { dialogs.push(options); },
        electron: { ipcRenderer: { invoke: async (...args) => { choices.push(args); return ["chosen"]; } } } });
    const context = { clashApi: { flushFakeIpCache: async () => ({ status, data: { message: "core diagnostic" } }) } };
    for (language of [0, 1, 0]) {
        status = 204;
        await page.methods.handlerClearFakeIPCache.call(context);
        assert.equal(dialogs.at(-1).message, labels.fakeIPCacheCleared());
        status = 500;
        await page.methods.handlerClearFakeIPCache.call(context);
        assert.equal(dialogs.at(-1).message, labels.fakeIPCacheClearFailed({ reason: "core diagnostic" }));
        for (const file of [true, false]) {
            assert.equal(await page.methods.chooseFileOrPath(file), "chosen");
            const options = choices.at(-1)[2];
            assert.equal(options.title, file ? labels.openFile() : labels.openFolder());
            assert.equal(options.buttonLabel, labels.open());
            assert.deepEqual(options.properties, [file ? "openFile" : "openDirectory"]);
        }
    }
});

test("external editor waiting dialog translates the sentence while keeping the editor name", () => {
    Vue.use(Vuex);
    for (const locale of [0, 1]) {
        const labels = createTranslator(locale);
        const store = new Vuex.Store({ state: { app: { settings: {}, confData: {} } }, getters: { secret: () => "" } });
        const vm = new (Vue.extend(createPage({ getLanguage: () => labels })))({ store });
        vm.settings = { editor: 1 }; vm.isEditingExternal = true;
        vm.isLinux = false; vm.isMacOS = false; vm.isWindows = true;
        const text = node => !node ? "" : (node.text || "") + (node.children || node.componentOptions?.children || []).map(text).join("");
        assert.ok(text(vm._render()).includes(labels.externalEditorLaunching({ editor: "Visual Studio Code" })));
        vm.settings = { editor: 2, editorCustomCommand: "notepad.exe private-argument" };
        const custom = text(vm._render());
        assert.ok(custom.includes(labels.externalEditorLaunching({ editor: labels.custom() })));
        assert.equal(custom.includes("Sublime Text"), false);
        assert.equal(custom.includes("private-argument"), false);
        vm.$destroy();
    }
});

test("Settings navigation matches the visible sections on all platforms and ignores stale indexes", () => {
    Vue.use(Vuex);
    for (const platform of ["win32", "linux", "darwin"]) {
        const store = new Vuex.Store({ state: { app: { settings: {}, confData: {} } }, getters: { secret: () => "", clashAxiosClient: () => null } });
        const vm = new (Vue.extend(createPage()))({ store });
        vm.settings = {};
        vm.isWindows = platform === "win32"; vm.isMacOS = platform === "darwin"; vm.isLinux = platform === "linux";
        const nodes = node => !node ? [] : [node, ...(node.children || node.componentOptions?.children || []).flatMap(nodes)];
        const visible = nodes(vm._render()).filter(node => node.componentOptions?.tag === "Section"
            && node.componentOptions.children.some(child => child.tag)).map(node => node.componentOptions.propsData.title);
        assert.deepEqual(Array.from(vm.sections), visible);
        const container = { children: visible.map((_item, i) => ({ offsetTop: i * 200 })), scrollTop: 7 };
        const context = { $refs: { "mixin-scroll-content": container }, $nextTick: callback => callback() };
        vm.$options.methods.handleNavigateToGroup.call(context, visible.length - 1);
        assert.equal(container.scrollTop, (visible.length - 1) * 200 - 110);
        assert.doesNotThrow(() => vm.$options.methods.handleNavigateToGroup.call(context, visible.length));
        vm.$destroy();
    }
});

test("Security Core Secret changes only after confirmation, preserves configuration, and waits for saving before restart", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-secret-settings-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const file = path.join(directory, "config.yaml");
    const previous = randomUUID();
    fs.writeFileSync(file, yaml.stringify({ secret: previous, "mixed-port": 7895, "allow-lan": false }));
    let confirmation = 0, generated, writes = 0, restarts = 0, fail = false, locks = 0;
    const page = createPage({
        uuid: { v4: () => { generated = randomUUID(); return generated; } },
        showMessageBox: async () => ({ response: confirmation }),
        updateYaml: async (target, key, value) => {
            if (fail) throw new Error("save failed");
            await Promise.resolve();
            updateYamlValue({ fs, path, yaml, file: target, key, value });
            writes++;
        }
    });
    const model = { clashPath: directory, $parent: { runProxyOperation(name, action) {
        assert.equal(name, "core"); locks++; return action();
    } }, reloadElectron() {
        assert.ok(yaml.parse(fs.readFileSync(file, "utf8")).secret === generated);
        restarts++;
    } };
    await page.methods.handleGenerateUUIDSecret.call(model);
    assert.equal(writes, 0); assert.equal(restarts, 0);
    assert.equal(locks, 0);
    confirmation = 1;
    await page.methods.handleGenerateUUIDSecret.call(model);
    const saved = yaml.parse(fs.readFileSync(file, "utf8"));
    assert.ok(saved.secret !== previous && saved.secret === generated);
    assert.equal(saved["mixed-port"], 7895); assert.equal(saved["allow-lan"], false);
    assert.equal(writes, 1); assert.equal(restarts, 1);
    assert.equal(locks, 1);
    fail = true;
    await assert.rejects(page.methods.handleGenerateUUIDSecret.call(model), /save failed/);
    assert.equal(restarts, 1);
});

test("Security certificate exception edits persist through the settings proxy and cancellation preserves them", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-exception-settings-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const repository = createSettingsRepository({ fs, path, yaml });
    let settings = { disableLoadingAdsLink: false }, cancelled = false;
    const text = "urls:\n  - https://certificate.test/profile.yaml\n";
    const page = createPage();
    const model = { edit: page.methods.edit,
        settings: createSettingsProxy({ getSettings: () => settings, cloneDeep: structuredClone,
            saveSettings(value) { repository.save(directory, value); settings = value; } }),
        async $code() { if (cancelled) throw new Error("cancelled"); return { code: text }; }
    };
    await page.methods.handleEditUnsafeURLs.call(model);
    assert.equal(repository.load(directory).unsafeURLsText, text);
    assert.equal(repository.load(directory).disableLoadingAdsLink, false);
    cancelled = true;
    await page.methods.handleEditUnsafeURLs.call(model);
    assert.equal(repository.load(directory).unsafeURLsText, text);
});

test("Security compatibility switches require confirmation, persist explicitly and revoke without a restart", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-compatibility-settings-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const repository = createSettingsRepository({ fs, path, yaml });
    let settings = repository.load(directory), response = 0;
    const dialogs = [];
    const page = createPage({ showMessageBox: async options => { dialogs.push(options); return { response }; } });
    const model = { settings: createSettingsProxy({ getSettings: () => settings, cloneDeep: structuredClone,
        saveSettings(value) { repository.save(directory, value); settings = value; } }),
        $set(target, key, value) { target[key] = value; } };
    for (const [method, field] of [["handleRemoteProfileParsersChange", "allowRemoteProfileParsers"], ["handleHttpExternalLinksChange", "allowHttpExternalLinks"]]) {
        response = 0;
        await page.methods[method].call(model, true);
        assert.equal(model.settings[field], false);
        assert.equal(dialogs.at(-1).cancelId, 0);
        response = 1;
        await page.methods[method].call(model, true);
        assert.equal(repository.load(directory)[field], true);
        const count = dialogs.length;
        await page.methods[method].call(model, false);
        assert.equal(repository.load(directory)[field], false);
        assert.equal(dialogs.length, count);
    }
});

test("Security editors save scoped exceptions and preserve existing settings on invalid internal or external edits", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-scoped-settings-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const repository = createSettingsRepository({ fs, path, yaml });
    let settings = repository.load(directory), code;
    const dialogs = [];
    const page = createPage({ showMessageBox: async options => { dialogs.push(options); return { response: 0 }; },
        externalEditor: { edit: async () => code } });
    const model = { ...page.methods,
        settings: createSettingsProxy({ getSettings: () => settings, cloneDeep: structuredClone,
            saveSettings(value) { repository.save(directory, value); settings = value; } }),
        async $code() { return { code }; }
    };
    for (const editor of [0, 1]) {
        model.settings.editor = editor;
        for (const [method, field, valid, invalid] of [
            ["handleEditUnsafeOrigins", "unsafeURLOriginsText", "origins:\n  - https://trusted.test:8443\n", "origins:\n  - https://*.trusted.test\n"],
            ["handleEditDownloadExceptions", "profileDownloadExceptionsText", "exceptions:\n  - url: https://trusted.test/profile\n    maxSizeMiB: 64\n", "exceptions:\n  - url: https://trusted.test/profile\n    maxSizeMiB: 0\n"]
        ]) {
            code = valid;
            await page.methods[method].call(model);
            assert.equal(repository.load(directory)[field], valid);
            code = invalid;
            await page.methods[method].call(model);
            assert.equal(repository.load(directory)[field], valid);
            assert.equal(dialogs.at(-1).type, "error");
            assert.equal(model.isEditingExternal, false);
            code = "";
            await page.methods[method].call(model);
            assert.equal(repository.load(directory)[field], "", "clearing an exception must revoke it without retaining the old setting");
        }
    }
});

test("language dropdown updates page text, saved settings and tray without a window reload", async () => {
    const calls = [], storage = new Map([["language", 0]]);
    const cache = { get: key => storage.get(key) ?? null, put: (key, value) => storage.set(key, value) };
    const modifyState = Vue.observable({ language: 0 });
    const language = createRendererLanguage({ modifyState, cache,
        ipcRenderer: { invoke: async (...args) => calls.push(args) } });
    Vue.use(Vuex);
    const store = new Vuex.Store({ state: { app: { settings: {}, confData: {} } },
        getters: { secret: () => "", clashAxiosClient: () => null } });
    const vm = new (Vue.extend(createPage({ ...language, cache })))({ store });
    vm.settings = Vue.observable({ language: 0, draft: "keep this edit" });
    vm.isLinux = false;
    vm.isMacOS = false;
    vm.isWindows = true;
    const nodesOf = vnode => vnode ? [vnode, ...(vnode.children || vnode.componentOptions?.children || []).flatMap(nodesOf)] : [];
    const snapshots = [];
    vm.$watch(() => nodesOf(vm._render()).map(node => node.text || "").join(""), value => snapshots.push(value), { immediate: true });
    const selection = () => nodesOf(vm._render()).find(node => node.data?.attrs?.items?.[0] === "简体中文");
    assert.equal(selection().data.model.value, 0);
    const sectionTitles = () => nodesOf(vm._render()).filter(node => node.componentOptions?.tag === "Section"
        && node.componentOptions.children.some(child => child.tag))
        .map(node => node.componentOptions.propsData.title);
    assert.deepEqual(vm.sections, sectionTitles());
    assert.equal(vm.sections[0], "安全");
    assert.equal(vm.sections.length, 17);
    selection().data.model.callback(1);
    await Vue.nextTick();
    assert.match(snapshots.at(-1), /Settings/);
    assert.equal(selection().data.model.value, 1);
    assert.equal(vm.settings.language, 1);
    assert.equal(vm.settings.draft, "keep this edit");
    assert.equal(cache.get("language"), 1);
    assert.deepEqual(vm.sections, sectionTitles());
    assert.equal(vm.sections[0], "Security");
    selection().data.model.callback(1);
    selection().data.model.callback(0);
    await Vue.nextTick();
    assert.match(snapshots.at(-1), /设置/);
    assert.deepEqual(vm.sections, sectionTitles());
    assert.deepEqual(calls, [["cfw-language", 1], ["cfw-language", 0]]);
    vm.$destroy();
});

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
    const renderedText = nodes.map(node => node.text || "").join("");
    for (const label of ["trustedCertificateOrigins", "profileDownloadExceptions", "allowRemoteProfileParsers", "allowHttpExternalLinks"]) {
        assert.ok(renderedText.includes(label), `Security control must render its label: ${label}`);
    }
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
        saveSettingsObject({ obj }) { this.settings = obj; },
        $set(target, key, value) { target[key] = value; },
        refreshCore: page.methods.refreshCore,
        $parent: {
            mode: "script",
            runProxyOperation: (_name, action) => action(),
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
