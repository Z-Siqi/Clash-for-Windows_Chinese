"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServerPageWorkflow, MANUAL_STOP } = require("../../main/dist/electron/features/profiles/server-page-workflow");

function createWorkflow(overrides = {}) {
    const dialogs = [];
    const labels = new Proxy({ locale: () => "en" }, {
        get(target, key) { return target[key] || (() => String(key)); }
    });
    const dependencies = {
        labels,
        getLanguage: () => labels,
        moment: value => ({ value, subtract() { return this; }, isBefore() { return false; }, locale() { return this; }, from() { return "now"; }, format() { return "date"; } }),
        yaml: { parse: () => ({}) },
        fs: {},
        path: { join: (...parts) => parts.join("/"), resolve: value => value, basename: value => value },
        electron: { clipboard: { readText: () => "" }, shell: {} },
        lodash: { debounce: callback => callback },
        CancelToken: class {},
        downloadProfile: async () => ({ success: true, targetIndex: 0 }),
        runUserScript() {}, profileScriptType: "profile",
        scheduler: { add: () => "timer", stop() {} },
        confirmOpenExternal() {}, cloneJson: value => value,
        showMessageBox: async options => { dialogs.push(options); return { response: 0 }; },
        formatBytes: String,
        schedule: callback => callback(),
        ...overrides
    };
    return { workflow: createServerPageWorkflow(dependencies), dialogs };
}

test("server page profile selection owns loading and failure recovery", async () => {
    const { workflow, dialogs } = createWorkflow();
    const selected = [];
    const page = {
        ...workflow.methods,
        loadingProfileIndex: [],
        async switchProfile() { throw new Error("invalid profile"); },
        changeProfilesIndex: payload => selected.push(payload)
    };

    await page.handleProfileClick(4);

    assert.deepEqual(page.loadingProfileIndex, []);
    assert.deepEqual(selected, [{ index: -1 }]);
    assert.equal(dialogs.length, 1);
    assert.equal(dialogs[0].detail, "invalid profile");
});

test("server page update delegates to the profile downloader and selects its result", async () => {
    const requests = [], selected = [];
    const { workflow } = createWorkflow({
        downloadProfile: async request => {
            requests.push(request);
            return { success: true, targetIndex: 3 };
        }
    });
    const page = {
        ...workflow.methods,
        switchProfile: async index => { selected.push(index); },
        $alert() { throw new Error("unexpected alert"); }
    };

    assert.equal(await page.updateConfig({ url: "https://example.test/profile", headers: "x:y", cancelToken: "token", selectAfterUpdated: true }), true);
    assert.deepEqual(requests, [{ url: "https://example.test/profile", headersString: "x:y", cancelToken: "token" }]);
    assert.deepEqual(selected, [3]);
});

test("manual and bulk updates reapply the current profile even when select-after-update is disabled", async () => {
    const selected = [];
    const { workflow } = createWorkflow({ downloadProfile: async ({ url }) => ({ success: true,
        targetIndex: url.endsWith("active") ? 1 : 0 }) });
    const page = { ...workflow.methods, pfs: { index: 1 }, settings: { selectAfterUpdated: false },
        profiles: [{ url: "https://fixture.test/other" }, { url: "https://fixture.test/active" }],
        downlodingUrls: {}, switchProfile: async index => selected.push(index),
        $delete: (target, key) => delete target[key], $alert() { assert.fail("unexpected error"); } };
    assert.equal(await page.updateConfig({ url: "https://fixture.test/active" }), true);
    assert.deepEqual(selected, [1]);
    selected.length = 0;
    await page.handleUpdateAllProfiles();
    assert.deepEqual(selected, [1]);
});

test("an in-flight update cannot switch back to a profile the user has since left", async () => {
    let complete;
    const { workflow } = createWorkflow({ downloadProfile: () => new Promise(resolve => { complete = resolve; }) });
    const page = { ...workflow.methods, pfs: { index: 1 }, switchProfile() { assert.fail("must preserve current selection"); } };
    const download = page.updateConfig({ url: "https://fixture.test/active" });
    page.pfs.index = 0;
    complete({ success: true, targetIndex: 1 });
    assert.equal(await download, true);
});

test("server page reports rejected downloads instead of silently swallowing them", async () => {
    const error = new Error("network unavailable");
    const { workflow } = createWorkflow({ downloadProfile: async () => { throw error; } });
    const alerts = [];
    const page = { ...workflow.methods, $alert: value => alerts.push(value) };

    assert.equal(await page.updateConfig({ url: "https://example.test/profile" }), false);
    assert.deepEqual(alerts, [{ content: "network unavailable" }]);
});

test("server page refresh returns its result and always releases the cancellation entry", async () => {
    const { workflow } = createWorkflow({
        CancelToken: class { constructor(executor) { executor(() => {}); } }
    });
    const page = {
        ...workflow.methods,
        downlodingUrls: {}, settings: {},
        async updateConfig() { return true; },
        $delete(target, key) { delete target[key]; },
        $alert() { throw new Error("unexpected alert"); }
    };

    assert.equal(await page.refreshProfile({ url: "https://example.test/profile" }), true);
    assert.deepEqual(page.downlodingUrls, {});
});

test("server page paste waits for the Electron 44 clipboard promise", async () => {
    const { workflow } = createWorkflow({
        electron: {
            clipboard: { readText: async () => "https://example.test/profile" },
            shell: {}
        }
    });
    const page = { ...workflow.methods, inputFocus: true, subUrl: "" };

    await page.pasteURL();

    assert.equal(page.subUrl, "https://example.test/profile");
    assert.equal(page.inputFocus, true);
});

test("server page paste restores focus when clipboard access fails", async () => {
    const error = new Error("clipboard unavailable");
    const { workflow } = createWorkflow({
        electron: {
            clipboard: { readText: async () => { throw error; } },
            shell: {}
        }
    });
    const page = { ...workflow.methods, inputFocus: true, subUrl: "unchanged" };

    await assert.rejects(page.pasteURL(), error);

    assert.equal(page.subUrl, "unchanged");
    assert.equal(page.inputFocus, true);
});

test("server page route lifecycle starts and permanently releases owned resources", async () => {
    const calls = [], cancellations = [];
    const { workflow } = createWorkflow({
        scheduler: {
            add(callback, interval) { calls.push(["add", interval]); return "timer-1"; },
            stop(id) { calls.push(["stop", id]); }
        }
    });
    const page = {
        pfs: { files: [{ time: "1.yml" }] },
        setupWatcher() { calls.push(["watch"]); },
        removeWatcher() { calls.push(["unwatch"]); },
        downlodingUrls: { first: reason => cancellations.push(reason) }
    };
    workflow.beforeRouteEnter(null, null, callback => callback(page));
    await new Promise(resolve => setImmediate(resolve));
    workflow.beforeRouteLeave.call(page, null, null, () => calls.push(["next"]));

    assert.deepEqual(calls, [["add", 60000], ["watch"], ["stop", "timer-1"], ["unwatch"], ["next"]]);
    assert.deepEqual(cancellations, [MANUAL_STOP]);
});
