"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const { rendererComponents } = require("../fixtures/renderer-components");

Vue.use(Vuex);

function instantiate(component, propsData = {}) {
    const store = new Vuex.Store({ state: { app: { settings: {} } }, getters: { theme: () => "dark" } });
    return new (Vue.extend(component))({ store, propsData });
}

test("Shared UI: every production component bridge constructs and renders with the shipped Vue runtime", () => {
    const components = rendererComponents();
    // Node/browser globals must not be mistaken for Vue component dependencies.
    assert.equal(Object.hasOwn(components["script-editor"].components, "Navigator"), false);
    const props = {
        "simple-input": { value: "value", suffix: "ms" }, hint: { hint: "help" },
        navigator: { list: [] }, "select-view": { items: [] }, toggle: { on: false }
    };
    const errors = [];
    const oldHandler = Vue.config.errorHandler;
    Vue.config.errorHandler = error => errors.push(error);
    try {
        for (const [name, component] of Object.entries(components)) {
            assert.equal(typeof component.render, "function", name);
            const vm = instantiate(component, props[name]);
            assert.ok(vm._render(), name);
            vm.$destroy();
        }
    } finally { Vue.config.errorHandler = oldHandler; }
    assert.deepEqual(errors, []);
});

test("Shared UI: Escape/Ctrl-W, toggle and select preserve public events", () => {
    const components = rendererComponents();
    const esc = instantiate(components["esc-capture"]);
    let escapes = 0, prevented = 0, stopped = 0;
    esc.$on("esc", () => escapes++);
    const event = values => ({ preventDefault: () => prevented++, stopPropagation: () => stopped++, ...values });
    for (const value of [{ key: "Escape" }, { key: "w", ctrlKey: true }, { keyCode: 87, metaKey: true }, { keyCode: 87 }]) esc.handleKeyDown(event(value));
    assert.equal(escapes, 3);
    assert.equal(prevented, 3);
    assert.equal(stopped, 3);
    const toggle = instantiate(components.toggle, { on: true });
    let next;
    toggle.$on("change", value => { next = value; });
    toggle.handleClick();
    assert.equal(next, false);
    const select = instantiate(components["select-view"], { items: ["one", "two"] });
    select.$on("select", value => { next = value; });
    select.handleItemClick(1);
    assert.equal(next, 1);
    for (const vm of [esc, toggle, select]) vm.$destroy();
});

test("Shared UI: alert promises resolve/cancel and both locales render the actual labels", async () => {
    function text(vnode) { return (vnode.text || "") + (vnode.children || vnode.componentOptions?.children || []).map(text).join(""); }
    for (const locale of [0, 1]) {
        const alert = instantiate(rendererComponents({ locale }).alert);
        const accepted = alert.show({ title: "title", content: "body", isShowErrorBtn: true });
        const rendered = text(alert._render());
        assert.ok(rendered.includes(locale ? "Cancel" : "取消"));
        assert.ok(rendered.includes(locale ? "OK" : "确定"));
        alert.handleDone();
        assert.deepEqual(await accepted, {});
        const cancelled = alert.show({});
        const rejection = cancelled.then(() => false, () => true);
        alert.handleCancel();
        assert.equal(await rejection, true);
        assert.equal(alert.isShow, false);
        alert.$destroy();
    }
});

test("Shared UI: input validates required values before resolving", async () => {
    const input = instantiate(rendererComponents().input);
    input.$refs.ta0 = [{ style: {}, scrollHeight: 20 }];
    const result = input.show({ title: "input", data: [{ key: "name", value: "", required: true }] });
    input.handleDone();
    assert.equal(input.isShow, true);
    assert.ok(input.error);
    input.data[0].value = "accepted";
    input.handleDone();
    assert.deepEqual(await result, { name: "accepted" });
    await Vue.nextTick();
    input.$destroy();
});

test("Shared UI: code editor validates YAML, saves scroll position and disposes its editor", async () => {
    const positions = [], actions = [];
    let disposed = 0;
    let editorOptions;
    const editor = {
        onDidChangeModelContent() {}, addAction: action => actions.push(action), setSelection() {}, setScrollTop() {},
        onDidChangeCursorSelection() {},
        focus() {}, getScrollTop: () => 42, dispose: () => disposed++
    };
    const monaco = { editor: { create: (_element, options) => { editorOptions = options; return editor; } }, languages: { registerCompletionItemProvider() {} }, Selection: class {}, KeyMod: { CtrlCmd: 1 }, KeyCode: { KeyS: 2 } };
    const components = rendererComponents({ monaco, overrides: {
        utilities: { hashText: value => value },
        editorLanguages: {
            getScrollPosition: () => 0,
            saveScrollPosition: (...args) => positions.push(args)
        }
    } });
    const vm = instantiate(components["code-editor"]);
    const result = vm.show({ code: "mode: rule", language: "yaml" });
    await Vue.nextTick();
    assert.equal(editorOptions.links, false);
    assert.equal(actions[0].id, "save");
    vm.code = "mode: [";
    vm.save();
    assert.equal(vm.isShow, true);
    assert.match(vm.error, /Error/);
    vm.code = "mode: direct";
    vm.save();
    assert.deepEqual(await result, { code: "mode: direct" });
    await Vue.nextTick();
    assert.equal(disposed, 1);
    assert.deepEqual(positions, [["mode: direct", 42]]);
    vm.$destroy();
});

test("Shared UI: script editor uses semantic API and reports errors without leaving loading active", async () => {
    const dialogs = [], cache = new Map();
    let disposed = 0, failing = false;
    let editorOptions;
    const editor = {
        addAction() {}, setSelection() {}, focus() {}, dispose: () => disposed++,
        getValue: () => "script"
    };
    const monaco = { editor: { create: (_element, options) => { editorOptions = options; return editor; } }, languages: { registerCompletionItemProvider() {} }, Selection: class {}, KeyMod: { CtrlCmd: 1 }, KeyCode: { KeyS: 2 } };
    const vm = instantiate(rendererComponents({ monaco, overrides: {
        utilities: { showMessageBox: options => dialogs.push(options) },
        preferenceKeys: { TEST_SCRIPT_CONTENT: "script" },
        cache: { get: key => cache.get(key), put: (key, value) => cache.set(key, value) }
    } })["script-editor"]);
    vm.clashApi = { runScript: async payload => {
        assert.equal(payload.script, "script");
        if (failing) throw Error("offline");
        return { data: { result: "DIRECT" } };
    } };
    const completion = vm.show().then(() => false, () => true);
    await Vue.nextTick();
    assert.equal(editorOptions.links, false);
    await vm.test();
    assert.match(dialogs[0].message, /DIRECT/);
    assert.equal(cache.get("script"), "script");
    failing = true;
    await vm.test();
    assert.equal(dialogs[1].type, "error");
    assert.equal(vm.isLoading, false);
    vm.cancel();
    assert.equal(await completion, true);
    await Vue.nextTick();
    assert.equal(disposed, 1);
    vm.$destroy();
});
