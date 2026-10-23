"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const lodash = require("../../main/node_modules/lodash");
const { createSimpleInput } = require("../../main/dist/electron/features/renderer-ui/components/simple-input");
const { createGeneralPageWorkflow } = require("../../main/dist/electron/features/clash-core/general-page-workflow");
const { createSettingsPageOptions } = require("../../main/dist/electron/features/settings/page-options");
const { createInput } = require("../../main/dist/electron/features/renderer-ui/components/input");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { parsePort } = require("../../main/dist/electron/core/network/tcp-port");
const { createSettingsPageComponents } = require("../../main/dist/electron/features/settings/page-components");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");

test("separate settings inputs retain both rapid edits and flush the final edit on blur", async () => {
    const Control = Vue.extend(createSimpleInput({ lodash }));
    const left = new Control(), right = new Control(), events = [];
    left.$on("change", value => events.push(["left", value]));
    right.$on("change", value => events.push(["right", value]));
    left.handleTextChange({ target: { value: "first" } });
    right.handleTextChange({ target: { value: "second" } });
    await new Promise(resolve => setTimeout(resolve, 550));
    assert.deepEqual(events, [["left", "first"], ["right", "second"]]);
    left.handleTextChange({ target: { value: "last" } });
    left.handleBlur();
    assert.deepEqual(events.at(-1), ["left", "last"]);
    left.$destroy(); right.$destroy();
});

test("PAC port input validates raw numbers, preserves the previous setting and allows an empty random choice", () => {
    const events = [];
    const vm = new (Vue.extend(createSimpleInput({ lodash })))({ propsData: { type: "number", value: 7890,
        validate: value => value === "" || parsePort(value) !== null ? "" : "invalid" } });
    vm.$on("change", value => events.push(value));
    for (const value of ["65536", "0", "-1", "1234.5"]) {
        vm.handleTextChange({ target: { value } });
        vm.handleBlur();
        assert.equal(events.length, 0);
        assert.equal(vm.validationError, "invalid");
    }
    vm.handleTextChange({ target: { value: "" } }); vm.handleBlur();
    assert.deepEqual(events, [""]);
    vm.$destroy();
});

test("autostart waits for the OS, blocks duplicate clicks and preserves state on failure", async () => {
    const writes = [], errors = [];
    let finish, calls = 0;
    const pending = new Promise((_resolve, reject) => { finish = reject; });
    const workflow = createGeneralPageWorkflow({
        cache: { get() {}, put: (...args) => writes.push(args) }, keys: { AUTO_LAUNCH: "auto" },
        getLanguage: () => createTranslator(1), utilities: { showMessageBox: async options => errors.push(options) }
    });
    const page = { ...workflow.data(), $setAutoLaunch() { calls++; return pending; } };
    page.autoLaunchLoading = false;
    const task = workflow.methods.handleAutoLaunchSwitchClick.call(page);
    assert.equal(page.autoLaunchLoading, true);
    workflow.methods.setupSwitches.call(page);
    assert.equal(page.autoLaunchLoading, true);
    assert.equal(page.autoLaunch, false);
    await workflow.methods.handleAutoLaunchSwitchClick.call(page);
    assert.equal(calls, 1);
    finish(new Error("fixture rejection"));
    await task;
    assert.equal(page.autoLaunch, false);
    assert.equal(page.autoLaunchLoading, false);
    assert.equal(writes.length, 0);
    assert.equal(errors.length, 1);
    page.$setAutoLaunch = async () => {};
    await workflow.methods.handleAutoLaunchSwitchClick.call(page);
    assert.equal(page.autoLaunch, true);
    assert.deepEqual(writes, [["auto", true]]);
});

test("closing the quit confirmation without Yes never exits", async () => {
    let exits = 0;
    const options = createSettingsPageOptions({ Vuex: { mapState: () => ({}), mapGetters: () => ({}), mapActions: () => ({}), mapMutations: () => ({}) },
        getLanguage: () => createTranslator(1), showMessageBox: async () => ({ response: -1 }),
        electron: { ipcRenderer: { send() { exits++; } } } });
    const vm = { $parent: { quit() { exits++; } } };
    await options.methods.handleQuit.call(vm, false);
    await options.methods.handleQuit.call(vm, true);
    assert.equal(exits, 0);
});

test("required input fields reject untouched and whitespace-only values but accept zero", () => {
    const Component = createInput({ Vuex: { mapGetters: () => ({}) }, getLanguage: () => createTranslator(1) });
    const vm = new (Vue.extend(Component))();
    let resolved = false;
    vm.resolve = () => { resolved = true; };
    for (const value of [undefined, null, "", "   "]) {
        vm.data = [{ key: "name", required: true, value }];
        vm.handleDone();
        assert.equal(resolved, false);
    }
    vm.data = [{ key: "port", required: true, value: 0 }];
    vm.handleDone();
    assert.equal(resolved, true);
    vm.$destroy();
});

test("Chinese IME composition emits only the completed input value", () => {
    const vm = new (Vue.extend(createSimpleInput({ lodash })))(), events = [];
    vm.$on("change", value => events.push(value));
    vm.handleTextChange({ isComposing: true, target: { value: "zhong" } });
    vm.handleBlur();
    assert.deepEqual(events, []);
    vm.handleTextChange({ type: "compositionend", target: { value: "中文" } });
    vm.handleBlur();
    assert.deepEqual(events, ["中文"]);
    vm.$destroy();
});

test("shortcut capture ignores held-key repeats instead of saving an invalid repeated accelerator", () => {
    const { KeyCapture } = createSettingsPageComponents({ defineComponent,
        Vuex: { mapState: () => ({}) }, getLanguage: () => createTranslator(1) });
    const vm = new (Vue.extend(KeyCapture))();
    vm.handleClick();
    vm.handleKeyDown({ key: "Control" });
    vm.handleKeyDown({ key: "a" });
    vm.handleKeyDown({ key: "a", repeat: true });
    vm.handleKeyDown({ key: "Control" });
    assert.equal(vm.shortcut, "Control+a");
    vm.$destroy();
});

test("new shortcut recordings normalize arrows and space without migrating existing settings", async () => {
    const { KeyCapture } = createSettingsPageComponents({ defineComponent,
        Vuex: { mapState: () => ({}) }, getLanguage: () => createTranslator(1) });
    const Parent = Vue.extend({ data: () => ({ saved: "Control+ArrowUp" }) });
    const parent = new Parent();
    const vm = new (Vue.extend(KeyCapture))({ propsData: { value: parent.saved } });
    KeyCapture.mounted.call(vm);
    vm.$on("change", value => { parent.saved = value; });
    parent.$watch("saved", value => { vm.value = value; });
    assert.equal(vm.shortcut, "Control+ArrowUp", "existing strings must not be silently registered in a new form");
    for (const [key, expected] of [["ArrowUp", "Up"], ["ArrowDown", "Down"], ["ArrowLeft", "Left"], ["ArrowRight", "Right"], [" ", "Space"], ["é", "é"], ["+", "+"]]) {
        vm.handleClick();
        vm.handleKeyDown({ key: "Control" }); vm.handleKeyDown({ key });
        await Vue.nextTick();
        assert.equal(vm.shortcut, `Control+${expected}`, "empty parent feedback must preserve a recording");
        vm.handleKeyDown({ keyCode: 13, key: "Enter" });
        await Vue.nextTick(); await Vue.nextTick();
        assert.equal(parent.saved, `Control+${expected}`);
    }
    let emissions = 0; vm.$on("change", () => emissions++);
    parent.saved = "";
    await Vue.nextTick(); await Vue.nextTick();
    assert.equal(vm.shortcut, ""); assert.equal(emissions, 0, "external reset is display synchronization, not another edit");
    vm.$destroy(); parent.$destroy();
});
