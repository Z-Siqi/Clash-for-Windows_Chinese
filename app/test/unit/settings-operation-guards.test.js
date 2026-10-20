"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { settingsElement, guardSettingsMethods, isProxySetting } = require("../../main/dist/electron/features/settings/proxy-operation-guards");
const { createSettingsProxy } = require("../../main/dist/electron/features/settings/settings-proxy");

test("busy settings disable only network controls and reject stale model callbacks", () => {
    const changes = [];
    const vm = { proxyBusy: false };
    const h = settingsElement(vm, (tag, data) => ({ tag, data }));
    const core = h("SelectView", { model: { expression: "settings.proxyCore", callback: value => changes.push(value) } });
    vm.proxyBusy = true;
    core.data.model.callback("clash");
    assert.deepEqual(changes, []);
    const disabled = h("SelectView", { model: { expression: "settings.proxyCore", callback() {} } });
    assert.equal(disabled.data.attrs["aria-disabled"], "true");
    assert.equal(disabled.data.attrs.inert, "");
    const appearance = h("SwitchView", { model: { expression: "settings.hideTrayIcon", callback: value => changes.push(value) } });
    assert.equal(appearance.data.attrs, undefined);
    appearance.data.model.callback(true);
    assert.deepEqual(changes, [true]);
    vm.proxyBusy = false;
    core.data.model.callback("clash");
    assert.deepEqual(changes, [true, "clash"]);
});

test("settings actions and an existing settings proxy respect the live operation guard", () => {
    let busy = false, saved = { proxyCore: "mihomo", editorFontSize: 13 }, executions = 0;
    const proxy = createSettingsProxy({ getSettings: () => saved, saveSettings: value => { saved = value; }, cloneDeep: structuredClone,
        canWrite: key => !busy || !isProxySetting(key) });
    const methods = guardSettingsMethods({ handleProxyCoreChange() { executions++; } });
    const vm = { $parent: { proxyBusy: true } };
    assert.equal(methods.handleProxyCoreChange.call(vm, 0), false);
    busy = true; proxy.proxyCore = "clash"; proxy.editorFontSize = 15;
    assert.equal(saved.proxyCore, "mihomo");
    assert.equal(saved.editorFontSize, 15);
    assert.equal(executions, 0);
    busy = false; proxy.proxyCore = "clash";
    assert.equal(saved.proxyCore, "clash");
});
