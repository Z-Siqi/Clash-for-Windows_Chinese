"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const moment = require("../../main/dist/electron/core/i18n/moment");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const { createServerPage } = require("../../main/dist/electron/features/profiles/server-page");
const { createServerPageWorkflow } = require("../../main/dist/electron/features/profiles/server-page-workflow");

Vue.use(Vuex);
const settle = async () => { await Vue.nextTick(); await new Promise(setImmediate); };
function pending() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(t, readTimes) {
    const calls = [], timers = new Map(), watches = [];
    const labels = createTranslator(0);
    const store = new Vuex.Store({ state: { app: { profilesPath: "", profiles: {} } }, getters: { clashAxiosClient: () => ({}) } });
    const workflow = createServerPageWorkflow({ labels, getLanguage: () => labels, moment,
        lodash: { debounce: callback => callback },
        profileFiles: {
            modificationTimes: folder => { calls.push(folder); return readTimes(folder); },
            watch(folder, onChange) {
                const watch = { folder, onChange, closed: false, close() { this.closed = true; } };
                watches.push(watch); return watch;
            }
        },
        scheduler: { add(callback) { const key = {}; timers.set(key, callback); return key; }, stop: key => timers.delete(key) }
    });
    const Empty = { render: h => h("div") };
    const Page = createServerPage({ defineComponent, Vuex, getLanguage: () => labels, workflow,
        draggable: Empty, ProfileEditor: Empty, RuleEditor: Empty, Hint: Empty });
    const page = new (Vue.extend(Page))({ store });
    const enter = () => workflow.beforeRouteEnter({}, {}, callback => callback(page));
    const leave = () => workflow.beforeRouteLeave.call(page, {}, {}, () => {});
    t.after(() => { leave(); page.$destroy(); });
    function ready(folder = "virtual-profiles") {
        store.state.app.profilesPath = folder;
        store.state.app.profiles = { index: -1, files: [{ name: "local", time: "local.yml", url: "" }] };
    }
    return { page, store, calls, timers, watches, enter, leave, ready };
}

test("restoring the profiles route before startup directories are ready automatically loads real modification times", async t => {
    const read = pending();
    const f = fixture(t, () => read.promise);
    await f.enter();
    assert.deepEqual(f.calls, [], "startup must not read an uninitialized directory");
    assert.notEqual(f.page.parseTime({ time: "local.yml" }), "missing file");
    f.ready(); await settle();
    assert.deepEqual(f.calls, ["virtual-profiles"]);
    assert.notEqual(f.page.parseTime({ time: "local.yml" }), "missing file");
    read.resolve({ "local.yml": f.page.now.clone().subtract(5, "minutes").valueOf() });
    await settle();
    assert.equal(f.page.parseTime({ time: "local.yml" }), "5 分钟前");
    assert.equal(f.watches.filter(watch => !watch.closed).length, 1);
    assert.equal(f.timers.size, 1);
});

test("leaving during the initial metadata read cannot restart monitoring or publish stale times", async t => {
    const read = pending();
    const f = fixture(t, () => read.promise);
    f.ready(); f.enter(); await settle();
    f.leave();
    read.resolve({ "local.yml": Date.now() }); await settle();
    assert.equal(f.timers.size, 0);
    assert.equal(f.watches.filter(watch => !watch.closed).length, 0);
    assert.deepEqual(f.page.profileModificationTimes, {});
});

test("a changed startup directory discards earlier metadata and keeps one watcher", async t => {
    const old = pending(), current = pending();
    const f = fixture(t, folder => folder === "first" ? old.promise : current.promise);
    f.ready("first"); f.enter(); await settle();
    f.ready("second"); await settle();
    const modified = f.page.now.clone().subtract(2, "hours").valueOf();
    current.resolve({ "local.yml": modified }); await settle();
    old.resolve({ "local.yml": 0 }); await settle();
    assert.equal(f.page.parseTime({ time: "local.yml" }), "2 小时前");
    assert.equal(f.watches.filter(watch => !watch.closed).length, 1);
    assert.equal(f.watches.at(-1).folder, "second");
});

test("failed startup metadata remains unknown and can recover while a confirmed missing file stays distinct", async t => {
    let fail = true;
    const f = fixture(t, async () => {
        if (fail) throw Error("temporary metadata failure");
        return { "local.yml": moment().subtract(5, "minutes").valueOf(), "gone.yml": 0 };
    });
    f.ready(); await f.enter(); await settle();
    assert.notEqual(f.page.parseTime({ time: "local.yml" }), "missing file");
    assert.equal(f.watches.filter(watch => !watch.closed).length, 1);
    fail = false;
    for (const timer of f.timers.values()) await timer();
    await settle();
    assert.equal(f.page.parseTime({ time: "local.yml" }), "5 分钟前");
    assert.equal(f.page.parseTime({ time: "gone.yml" }), "missing file");
});

test("leaving before directory initialization never activates a cached profiles page", async t => {
    const f = fixture(t, async () => ({}));
    f.enter(); f.leave(); f.ready(); await settle();
    assert.deepEqual(f.calls, []);
    assert.equal(f.watches.length, 0);
    assert.equal(f.timers.size, 0);
});

test("a fresh empty profile list creates its default only once after startup readiness", async t => {
    const f = fixture(t, async () => ({}));
    const created = [], selected = [];
    f.page.localCopy = async name => { created.push(name); f.store.state.app.profiles.files.push({ time: "new.yml", url: "" }); };
    f.page.switchProfile = async index => { selected.push(index); };
    f.enter();
    f.store.state.app.profilesPath = "virtual-profiles";
    f.store.state.app.profiles = { index: -1, files: [] };
    await settle();
    f.enter(); await f.page.startProfileFileMonitoring(); await settle();
    assert.deepEqual(created, ["config.yaml"]);
    assert.deepEqual(selected, [0]);
    assert.equal(f.watches.filter(watch => !watch.closed).length, 1);
    assert.equal(f.timers.size, 1);
});
