"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const { createSelect } = require("../../main/dist/electron/features/renderer-ui/components/select");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

function nodes(node) { return !node ? [] : [node, ...(node.children || node.componentOptions?.children || []).flatMap(nodes)]; }

test("a large selection uses a bounded native list and confirms only the chosen target", async () => {
    const component = createSelect({ Vuex: { mapGetters: () => ({}) }, escCaptureComponent: {}, getLanguage: () => createTranslator(1) });
    const vm = new (Vue.extend(component))();
    const choices = Array.from({ length: 500 }, (_, index) => `node-${index}`);
    const result = vm.show({ title: "Replace", items: ["Cancel", "Replace"], choiceItems: choices, choiceTitle: "Target" });
    const tree = nodes(vm.$options.render.call(vm));
    const list = tree.find(node => node.tag === "select");
    assert.equal(list.data.attrs.size, 8);
    assert.equal(list.children.length, 500);
    assert.equal(tree.filter(node => node.data?.staticClass === "btn").length, 2);
    list.data.on.change({ target: { value: "499" } });
    assert.equal(vm.isShow, true, "choosing a target must not commit deletion");
    vm.handleItemSelect(1);
    assert.deepEqual(await result, [1, 499]);
    const later = vm.show({ items: ["OK"] });
    assert.deepEqual(vm.choiceItems, []);
    vm.handleItemSelect(0);
    assert.deepEqual(await later, [0], "ordinary dialogs preserve their existing response shape");
    vm.$destroy();
});

test("cancelling a large target list rejects without applying the highlighted item", async () => {
    const component = createSelect({ Vuex: { mapGetters: () => ({}) }, escCaptureComponent: {}, getLanguage: () => createTranslator(0) });
    const vm = new (Vue.extend(component))();
    const result = vm.show({ items: ["Cancel", "Replace"], choiceItems: ["DIRECT", "node"] });
    vm.choiceIndex = 1;
    vm.handleCancel();
    await assert.rejects(result);
    vm.$destroy();
});
