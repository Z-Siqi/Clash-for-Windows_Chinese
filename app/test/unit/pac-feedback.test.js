"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { pacPortPolicy } = require("../../main/dist/electron/core/network/pac-port-policy");
const { createPacFeedback } = require("../../main/dist/electron/features/home/pac-feedback");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

test("only a nonempty invalid configured PAC port is a legacy error", () => {
    for (const value of [undefined, null, "", "  "]) assert.deepEqual(pacPortPolicy(value), { port: null, invalid: false });
    for (const value of [0, -1, 65536, "1234.5", "abc"]) assert.equal(pacPortPolicy(value).invalid, true);
    for (const value of [1, "7890", 65535]) assert.equal(pacPortPolicy(value).invalid, false);
});

test("uninitialized state and core startup, restart, switch or disconnect cannot produce a PAC warning", async () => {
    const calls = [];
    const feedback = createPacFeedback({ getLanguage: () => createTranslator(1), showMessageBox: async value => calls.push(value) });
    for (const state of ["uninitialized", "starting", "restarting", "switching", "offline", "ready"]) {
        const vm = { innerServerPort: 0, clashStatus: state, isCoreRestarting: state === "restarting" };
        await feedback(vm, undefined);
        await feedback(vm, { port: 1234, invalidConfiguredPort: false });
    }
    assert.deepEqual(calls, []);
});

test("invalid legacy port warning is shown once and only an explicit choice updates saved settings", async () => {
    for (const response of [0, 1, 2, -1]) {
        const calls = [], writes = [];
        const feedback = createPacFeedback({ getLanguage: () => createTranslator(1), showMessageBox: async options => { calls.push(options); return { response }; } });
        const vm = { settings: { innerServerPort: 65536 }, $set: (object, key, value) => { writes.push(value); object[key] = value; }, $input: async options => {
            assert.notEqual(options.data[0].validate("65536"), ""); return { port: "5678" };
        } };
        await feedback(vm, { port: 1234, invalidConfiguredPort: true });
        await feedback(vm, { port: 1234, invalidConfiguredPort: true });
        assert.equal(calls.length, 1); assert.match(calls[0].message, /1234/);
        assert.deepEqual(writes, response === 0 ? [""] : response === 1 ? [5678] : []);
    }
});

test("actual PAC listener failures retain their own cause even while the core is restarting", async () => {
    for (const [code, text] of [["EADDRINUSE", /occupied/], ["EACCES", /denied/], [undefined, /could not start/]]) {
        const calls = [];
        const feedback = createPacFeedback({ getLanguage: () => createTranslator(1), showMessageBox: async options => calls.push(options) });
        await feedback({ isCoreRestarting: true }, undefined, Object.assign(Error("failure"), { code }));
        assert.match(calls[0].message, text);
    }
});
