"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { homePage } = require("../fixtures/home-page");

test("startup keeps TUN actions blocked before and after an old controller answers", async () => {
    const page = homePage();
    let commits = 0;
    const store = { state: { app: { isLaunching: true } } };
    const vm = { ...page.data(), ...page.methods, $store: store,
        get isLaunching() { return page.computed.isLaunching.call(this); },
        get proxyBusy() { return page.computed.proxyBusy.call(this); },
        publishProxyState() {}, publishProxyOperation() {},
        chagneIsTunEnable() { commits++; } };
    assert.equal(await vm.requestProfileToggle("tun", true), false);
    store.state.app.isLaunching = false;
    assert.equal(await vm.requestProfileToggle("tun", true), false, "startup initialization is still in progress");
    vm.isInitializing = false;
    store.state.app.isLaunching = true;
    assert.equal(await vm.requestProfileToggle("tun", true), false, "the mapped launch state continues to guard local-core readiness");
    assert.equal(commits, 0);
});

test("the startup owner can start its core while actions stay blocked until the profile is applied", async () => {
    const page = homePage();
    const calls = [];
    const vm = { ...page.data(), ...page.methods, isLaunching: true,
        setIsLaunching({ isLaunching }) { this.isLaunching = isLaunching; },
        setClashStatus() {}, killClashCore: async () => calls.push("stop"), spawnClash: async () => calls.push("start") };
    assert.equal(await vm.handlerRestartClash(), false);
    await vm.handlerRestartClash({ initializing: true });
    assert.deepEqual(calls, ["stop", "start"]);
    assert.equal(vm.isCoreRestarting, false);
    assert.equal(page.computed.proxyBusy.call(vm), true);
    let apply, applications = 0;
    vm.refreshProfile = () => { applications++; return new Promise(resolve => { apply = resolve; }); };
    vm.checkMixedPortConflict = async () => {};
    await page.watch.clashStatus.call(vm, "connected");
    assert.equal(applications, 0, "a startup probe cannot apply an old core or release startup");
    vm.isInitializing = false;
    const ready = page.watch.clashStatus.call(vm, "connected");
    assert.equal(vm.isLaunching, true);
    apply({ success: true }); await ready;
    assert.equal(vm.isLaunching, false);
});

test("late status probes cannot update port state after a new core or controller was selected", async () => {
    let resolve;
    const page = homePage({ createClashCoreRuntime: () => ({ getStatus: () => new Promise(done => { resolve = done; }) }) });
    const vm = { ...page.data(), ...page.methods, controllerPort: 12345, clashMixedPort: 23456 };
    const pending = vm.getClashStatus();
    vm.coreRunRevision++;
    resolve({ connected: true, mixedPort: 0 });
    assert.equal(await pending, "disconnected");
    assert.equal(vm.clashMixedPort, 23456);
});

test("a first profile prepared during startup apply is included before deferred callers are released", async () => {
    let releaseFirst, applies = 0, selection = -1;
    const page = homePage({ refreshRendererProfile: async () => {
        const captured = selection;
        if (++applies === 1) await new Promise(resolve => { releaseFirst = resolve; });
        return { success: captured === 0 };
    } });
    const vm = { ...page.data(), ...page.methods };
    const deferred = vm.refreshProfile();
    const startup = vm.applyStartupProfile();
    await vm.prepareStartupProfiles(async () => { selection = 0; });
    releaseFirst();
    assert.deepEqual(await startup, { success: true });
    assert.deepEqual(await deferred, { success: true });
    assert.equal(applies, 2);
    assert.equal(vm.profileApplyCount, 0);
});

test("startup checks a zero mixed port after releasing both launch locks", async () => {
    const page = homePage();
    let checks = 0;
    const vm = { ...page.data(), ...page.methods, isLaunching: true,
        setIsLaunching({ isLaunching }) { this.isLaunching = isLaunching; },
        async checkMixedPortConflict() {
            assert.equal(page.computed.proxyBusy.call(this), false); checks++;
        } };
    await vm.finishStartup();
    assert.equal(checks, 1);
});

test("a failed ordinary core restart releases launch state so a different core can be tried", async () => {
    const page = homePage();
    const vm = { ...page.data(), ...page.methods, isInitializing: false, isLaunching: false,
        setIsLaunching({ isLaunching }) { this.isLaunching = isLaunching; }, setClashStatus() {},
        async killClashCore() {}, async spawnClash() {}, async waitForCoreReady() { return false; } };
    assert.equal(await vm.handlerRestartClash(), false);
    assert.equal(page.computed.proxyBusy.call(vm), false);
    vm.waitForCoreReady = async () => true;
    assert.equal(await vm.handlerRestartClash(), true);
});

test("an old core ready callback cannot publish a disconnected result over a replacement core", async () => {
    let ready, answer;
    const page = homePage({ createClashCoreRuntime: () => ({
        async start(options) { ready = options.onCoreReady; return {}; },
        getStatus: () => new Promise(resolve => { answer = resolve; })
    }) });
    const vm = { ...page.data(), ...page.methods, settings: {}, confData: {}, controllerPort: 23456,
        setClashStatus({ status }) { this.clashStatus = status; } };
    await vm.spawnClash();
    const pending = ready();
    vm.coreRunRevision++; vm.clashStatus = "connected";
    answer({ connected: true, mixedPort: 0 }); await pending;
    assert.equal(vm.clashStatus, "connected");
});
