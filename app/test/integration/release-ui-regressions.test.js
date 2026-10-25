"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const { rendererComponents } = require("../fixtures/renderer-components");
Vue.use(Vuex);

function instantiate(component) {
    return new (Vue.extend(component))({ store: new Vuex.Store({ getters: { theme: () => "dark" } }) });
}
const nodes = node => !node ? [] : [node, ...(node.children || node.componentOptions?.children || []).flatMap(nodes)];

test("Port input Enter confirms once, validates, and leaves multiline and IME input intact", () => {
    const vm = instantiate(rendererComponents().input);
    let confirmed = 0, prevented = 0;
    vm.isShow = true;
    vm.data = [{ key: "port", value: "7890", validate: value => value === "7890" ? "" : "invalid" }];
    vm.resolve = value => { assert.deepEqual(value, { port: "7890" }); confirmed++; };
    const enter = overrides => ({ key: "Enter", keyCode: 13, preventDefault: () => prevented++, stopPropagation() {}, ...overrides });
    vm.handleKeyDown(enter());
    assert.equal(confirmed, 0, "ordinary input dialogs still accept newlines");
    vm.submitOnEnter = true;
    vm.handleKeyDown(enter({ isComposing: true }));
    assert.equal(prevented, 0);
    vm.data[0].value = "65536";
    vm.handleKeyDown(enter());
    assert.equal(vm.isShow, true);
    assert.equal(vm.error, "invalid");
    vm.data[0].value = "7890";
    vm.handleKeyDown(enter());
    vm.handleKeyDown(enter({ repeat: true }));
    assert.equal(confirmed, 1);
    assert.equal(vm.isShow, false);
    vm.$destroy();
});

test("Script metadata retains numeric ports after real input callbacks", () => {
    const vm = instantiate(rendererComponents()["script-editor"]);
    vm.isShow = true;
    const ports = nodes(vm._render()).filter(node => node.tag === "input" && node.data.attrs.type === "number");
    ports[0].data.on.input({ target: { value: "7891" } });
    ports[1].data.on.input({ target: { value: "8443" } });
    assert.equal(vm.metadata.sourcePort, 7891);
    assert.equal(vm.metadata.destinationPort, 8443);
    vm.$destroy();
});

test("Diff closes and component destruction release their owned Monaco models", async () => {
    let models = 0, editors = 0;
    const monaco = { editor: {
        create() {}, createModel(code) { models++; return { getValue: () => code, dispose() { models--; } }; },
        createDiffEditor() { editors++; return { addAction() {}, setModel() {}, dispose() { editors--; } }; }
    }, languages: { registerCompletionItemProvider() {} }, KeyMod: { CtrlCmd: 1 }, KeyCode: { KeyS: 2 } };
    const vm = instantiate(rendererComponents({ monaco })["diff-editor"]);
    for (let index = 0; index < 20; index++) {
        const pending = vm.show({ base: "rules: []", change: "rules: []" }).catch(() => {});
        await Vue.nextTick();
        await vm.handleCancel();
        await pending;
        await Vue.nextTick();
        assert.equal(models, 0);
        assert.equal(editors, 0);
    }
    vm.show({ base: "rules: []", change: "rules: []" }).catch(() => {});
    await Vue.nextTick();
    vm.$destroy();
    assert.equal(models, 0);
    assert.equal(editors, 0);
});
