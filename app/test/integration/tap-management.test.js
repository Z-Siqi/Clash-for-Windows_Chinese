"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createTapViews } = require("../../main/dist/electron/features/clash-core/tap-management-view");
const Empty = { render: h => h("span") };
const nodes = node => !node ? [] : [node, ...(node.children || node.componentOptions?.children || []).flatMap(nodes)];

test("TAP Manage renders three segmented actions in both languages and blocks changes while busy", () => {
    for (const language of [0, 1]) {
        const labels = createTranslator(language);
        const { TapManagementView } = createTapViews({ defineComponent, EscCapture: Empty, Hint: Empty, getLanguage: () => labels });
        const vm = new (Vue.extend(TapManagementView))({ propsData: { mode: "mixin", installed: true, busy: false } });
        const changes = [], actions = [];
        vm.$on("change-mode", mode => changes.push(mode)); vm.$on("action", action => actions.push(action));
        const segments = () => nodes(vm._render()).filter(node => node.tag === "button" && node.data.attrs["data-tap-mode"]);
        assert.deepEqual(segments().map(node => node.children[0].text), [labels.enable(), labels.tapMixinOnly(), labels.tapDisable()]);
        assert.deepEqual(segments().map(node => node.data.attrs["aria-pressed"]), ["false", "true", "false"]);
        segments()[0].data.on.click(); segments()[1].data.on.click();
        assert.deepEqual(changes, ["enabled"]);
        vm.busy = true; segments()[2].data.on.click();
        assert.deepEqual(changes, ["enabled"]);
        const actionButtons = nodes(vm._render()).filter(node => node.tag === "button" && !node.data.attrs["data-tap-mode"]);
        actionButtons[0].data.on.click(); assert.deepEqual(actions, []);
        assert.ok(nodes(vm._render()).some(node => node.text?.includes('"cfw-tap": true')));
        vm.$destroy();
    }
});

test("TAP icon color reflects installation while Router, Router Off and lock reflect permission", () => {
    const { TapStatusIcon } = createTapViews({ defineComponent, Hint: Empty, getLanguage: () => createTranslator(0) });
    for (const installed of [true, false, null]) for (const mode of ["enabled", "mixin", "disabled"]) {
        const vm = new (Vue.extend(TapStatusIcon))({ propsData: { installed, mode } });
        const rendered = nodes(vm._render()), container = rendered.find(node => node.data?.attrs?.role === "img");
        assert.equal(container.data.style.color, installed === true ? "#13AF42" : "#8b9299");
        assert.equal(rendered.some(node => node.text === "lock"), installed === true && mode === "mixin");
        assert.equal(rendered.some(node => node.text === "router"), installed === true && mode !== "disabled");
        assert.equal(rendered.some(node => node.data?.class?.["cfw-tap-router-locked"]), installed === true && mode === "mixin");
        assert.equal(rendered.some(node => node.tag === "svg"), installed !== true || mode === "disabled");
        assert.ok(container.data.attrs["aria-label"]);
        vm.$destroy();
    }
});

test("TAP multicast compatibility is opt-in, explains the loop risk and ignores busy changes", () => {
    for (const language of [0, 1]) {
        const labels = createTranslator(language);
        const { TapManagementView } = createTapViews({ defineComponent, EscCapture: Empty, Hint: Empty, getLanguage: () => labels });
        const vm = new (Vue.extend(TapManagementView))({ propsData: { mode: "mixin", installed: true } });
        const changes = []; vm.$on("change-multicast", value => changes.push(value));
        const checkbox = () => nodes(vm._render()).find(node => node.tag === "input");
        assert.equal(checkbox().data.domProps.checked, false);
        assert.ok(nodes(vm._render()).some(node => node.text === labels.tapAllowMulticastDescribe()));
        checkbox().data.on.change({ target: { checked: true } });
        assert.deepEqual(changes, [true]);
        vm.allowMulticast = true;
        assert.equal(checkbox().data.domProps.checked, true);
        vm.busy = true;
        assert.equal(checkbox().data.attrs.disabled, true);
        checkbox().data.on.change({ target: { checked: false } });
        assert.deepEqual(changes, [true]);
        vm.$destroy();
    }
});
