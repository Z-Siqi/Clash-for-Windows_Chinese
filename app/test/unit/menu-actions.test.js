"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createMenu } = require("../../main/dist/electron/features/renderer-ui/components/menu");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

test("nested context menu cancellation is quiet, disabled actions stay disabled and real failures are visible", async () => {
    const page = createMenu({ getLanguage: () => createTranslator(1) });
    const alerts = [], calls = [];
    const vm = { isShow: true, $alert: async options => alerts.push(options) };
    const execute = item => page.methods.handleItemSelect.call(vm, item);
    await execute({ disabled: true, click: () => calls.push("disabled") });
    await execute({ hide: true, click: () => calls.push("hidden") });
    assert.deepEqual(calls, []);
    await execute({ click: () => Promise.reject() }); assert.deepEqual(alerts, []);
    await execute({ click: async () => { throw Error("fixture operation failed"); } });
    assert.equal(alerts.length, 1); assert.match(alerts[0].content, /fixture operation failed/);
});
