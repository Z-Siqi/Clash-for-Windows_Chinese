"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { setManualMixedPort } = require("../../main/dist/electron/core/network/manual-mixed-port");
const { createGeneralPageWorkflow } = require("../../main/dist/electron/features/clash-core/general-page-workflow");
const { createHomePageOptions } = require("../../main/dist/electron/features/home/page-options");

function harness() {
    const calls = [];
    let actual = 24000, saved = 24000;
    const options = {
        clashApi: {
            async getConfig() { return { status: 200, data: { "mixed-port": actual } }; },
            async patchConfig(value) { actual = value["mixed-port"]; calls.push(actual); return { status: 204 }; }
        },
        checkAvailable: async () => true,
        persist: async value => { saved = value; }, sleep: async () => {}, port: 24001
    };
    return { options, calls, get actual() { return actual; }, set actual(value) { actual = value; }, get saved() { return saved; } };
}

test("manual port commits only a verified core change and preserves same-port fixed intent", async () => {
    const host = harness();
    assert.equal(await setManualMixedPort(host.options), 24001);
    assert.equal(host.saved, 24001);
    host.options.checkAvailable = () => { throw Error("must not probe our own listener"); };
    host.options.persist = async value => assert.equal(value, 24001);
    await setManualMixedPort(host.options);
    assert.deepEqual(host.calls, [24001]);
});

test("manual port rejects collisions before PATCH, including transport failures in preflight", async () => {
    const host = harness();
    host.options.checkAvailable = async () => false;
    await assert.rejects(setManualMixedPort(host.options), { reason: "unavailable" });
    assert.deepEqual(host.calls, []);
    host.options.checkAvailable = async () => { throw Error("unavailable core"); };
    await assert.rejects(setManualMixedPort(host.options), /unavailable core/);
    assert.deepEqual(host.calls, []);
    assert.equal(host.saved, 24000);
});

test("manual port restores native state after false 204, lost PATCH response or disk failure", async () => {
    for (const failure of ["false204", "transport", "disk"]) {
        const host = harness();
        const originalPatch = host.options.clashApi.patchConfig;
        host.options.clashApi.patchConfig = async value => {
            const result = await originalPatch(value);
            if (value["mixed-port"] === 24001) {
                if (failure === "false204") host.actual = 0;
                if (failure === "transport") throw Error("lost response after apply");
            }
            return result;
        };
        if (failure === "disk") host.options.persist = async () => { throw Error("read only"); };
        await assert.rejects(setManualMixedPort(host.options), { reason: failure === "disk" ? "persist" : "apply", actualPort: 24000 });
        assert.deepEqual(host.calls, [24001, 24000]);
        assert.equal(host.actual, 24000);
        assert.equal(host.saved, 24000);
    }
});

test("manual port reports rollback failure with actual state and does not persist it", async () => {
    const host = harness();
    host.options.clashApi.patchConfig = async value => {
        host.calls.push(value["mixed-port"]);
        host.actual = 0;
        return { status: 204 };
    };
    await assert.rejects(setManualMixedPort(host.options), { reason: "rollback", actualPort: 0 });
    assert.equal(host.saved, 24000);
});

test("manual port keeps custom hostname preflight inconclusive without blocking an existing core configuration", async () => {
    const host = harness();
    host.options.checkAvailable = async () => null;
    assert.equal(await setManualMixedPort(host.options), 24001);
    assert.equal(host.saved, 24001);
});

test("General manual port reacquires the shared lock after the dialog and never publishes a failed save", async () => {
    const labels = new Proxy({}, { get: (_target, key) => () => key });
    const workflow = createGeneralPageWorkflow({ getLanguage: () => labels, cache: { get() {} }, keys: {},
        path: { join: (...parts) => parts.join("/") }, checkMixedPort: async () => false,
        utilities: { updateYaml: async () => { throw Error("must not save"); } } });
    const parent = { proxyBusy: false, publishProxyState() {}, publishProxyOperation() {} };
    parent.runProxyOperation = createHomePageOptions({ Vuex: { mapState: () => ({}), mapGetters: () => ({}), mapMutations: () => ({}), mapActions: () => ({}) },
        lodash: { debounce: value => value }, getLanguage: () => labels }).methods.runProxyOperation.bind(parent);
    const host = harness();
    const alerts = [];
    let refreshes = 0, commits = 0;
    const page = { settings: { randomMixedPort: true }, port: 9999, confData: { "mixed-port": 24000 },
        clashPath: "test", clashApi: host.options.clashApi, $parent: parent,
        $input: async () => { parent.proxyBusy = true; return { port: "24001" }; },
        $alert: async value => alerts.push(value), setupComponent() { refreshes++; }, setConfData() { commits++; } };
    assert.equal(await workflow.methods.handleEditMixedPort.call(page), false);
    assert.equal(refreshes, 0);
    parent.proxyBusy = false;
    page.$input = async () => ({ port: "24001" });
    assert.equal(await workflow.methods.handleEditMixedPort.call(page), false);
    assert.equal(page.port, 24000);
    assert.equal(page.settings.randomMixedPort, true);
    assert.equal(commits, 0);
    assert.equal(refreshes, 1);
    assert.equal(parent.proxyOperation, "");
    assert.equal(alerts[0].content, "portUnavailable");
});
