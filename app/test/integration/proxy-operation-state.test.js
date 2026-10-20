"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const { homePage } = require("../fixtures/home-page");
const { trackProfileRefresh } = require("../../main/dist/electron/core/network/profile-refresh-state");
const { createToggle } = require("../../main/dist/electron/features/renderer-ui/components/toggle");
const { renderHomePage } = require("../../main/dist/electron/features/home/page-render");

function deferred() {
    let resolve, reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}

function model(overrides = {}) {
    const calls = [], notifications = [];
    const gate = deferred();
    const page = homePage({
        prepareMixin: async () => {},
        notify: (...args) => notifications.push(args),
        refreshRendererProfile(vm) {
            calls.push(vm.isTunEnable);
            const result = calls.length === 1 ? gate.promise : Promise.resolve({ success: true });
            trackProfileRefresh(vm.clashApi, result);
            return result;
        },
        ...overrides
    });
    // Use the production watchers with Vue's actual batched mutation/nextTick order.
    const vm = new Vue({
        data: () => ({
            ...page.data(), isTunEnable: false, isMixinEnable: false, isSystemProxyOn: false,
            isLaunching: false, settings: { legacyTapEnabled: true }, clashApi: {}, confData: {}
        }),
        computed: { proxyBusy: page.computed.proxyBusy },
        watch: { isTunEnable: page.watch.isTunEnable, isMixinEnable: page.watch.isMixinEnable, "settings.legacyTapEnabled": page.watch["settings.legacyTapEnabled"] },
        methods: {
            ...page.methods,
            updateTrayIcon() {},
            chagneIsTunEnable({ isTun }) { this.isTunEnable = isTun; },
            changeIsMixinEnable({ isMixin }) { this.isMixinEnable = isMixin; },
            setIsSystemProxyOn({ isOn }) { this.isSystemProxyOn = isOn; }
        }
    });
    return { vm, page, gate, calls, notifications };
}

test("TUN burst clicks share one apply and remain locked through the Vue watcher flush", async () => {
    const h = model();
    const request = h.vm.requestProfileToggle("tun", true);
    assert.equal(h.vm.proxyBusy, true);
    for (let i = 0; i < 100; i++) assert.equal(await h.vm.requestProfileToggle("tun", false), false);
    await Vue.nextTick();
    assert.deepEqual(h.calls, [true]);
    assert.equal(h.vm.profileApplyCount, 1);
    assert.equal(await h.vm.requestSystemProxy(true), false);
    h.gate.resolve({ success: true });
    assert.equal(await request, true);
    assert.equal(h.vm.isTunEnable, true);
    assert.equal(h.vm.proxyBusy, false);
    assert.equal(h.vm.profileApplyCount, 0);
    h.vm.$destroy();
});

test("failed TUN apply restores the saved switch and waits for rollback", async () => {
    const h = model();
    const request = h.vm.requestProfileToggle("tun", true);
    await Vue.nextTick();
    h.gate.resolve({ success: false, message: "core refused the configuration" });
    assert.equal(await request, false);
    assert.equal(h.vm.isTunEnable, false);
    assert.deepEqual(h.calls, [true, false]);
    assert.equal(h.vm.proxyBusy, false);
    assert.match(h.notifications[0][1], /core refused/);
    h.vm.$destroy();
});

test("legacy TAP opt-out shares the operation lock and rolls back a rejected configuration", async () => {
    for (const success of [true, false]) {
        const h = model();
        const request = h.vm.requestProfileToggle("tap", false);
        assert.equal(h.vm.proxyOperation, "tap");
        assert.equal(await h.vm.requestProfileToggle("tun", true), false);
        await Vue.nextTick();
        assert.equal(h.vm.profileApplyCount, 1);
        h.gate.resolve({ success, message: "test rejection" });
        assert.equal(await request, success);
        assert.equal(h.vm.settings.legacyTapEnabled, !success);
        assert.equal(h.vm.proxyBusy, false);
        assert.equal(h.calls.length, success ? 1 : 2);
        h.vm.$destroy();
    }
});

test("initial TAP preference load does not add a startup profile refresh", () => {
    const page = homePage();
    const model = { isLaunching: false, refreshProfile: () => assert.fail("startup owns initial configuration") };
    page.watch["settings.legacyTapEnabled"].call(model, true, undefined);
    model.isLaunching = true;
    page.watch["settings.legacyTapEnabled"].call(model, false, true);
});

test("async mixin validation is guarded before state changes and unlocks on error", async () => {
    const validation = deferred();
    const h = model({ prepareMixin: () => validation.promise });
    const request = h.vm.requestProfileToggle("mixin", true);
    assert.equal(h.vm.proxyBusy, true);
    assert.equal(await h.vm.requestProfileToggle("mixin", true), false);
    validation.reject(Error("invalid mixin"));
    assert.equal(await request, false);
    assert.equal(h.vm.isMixinEnable, false);
    assert.deepEqual(h.calls, []);
    assert.equal(h.vm.proxyBusy, false);
    h.vm.$destroy();
});

test("Mixin failures use an in-app alert even with system notifications disabled, and dismissal unlocks", async () => {
    const h = model({ prepareMixin: async () => { throw Error("invalid Mixin configuration"); } });
    const alert = deferred(), opened = deferred();
    let message;
    h.vm.settings.showNotifications = false;
    h.vm.$alert = options => { message = options; opened.resolve(); return alert.promise; };
    const request = h.vm.requestProfileToggle("mixin", true);
    await opened.promise;
    assert.equal(message.title, "Mixin");
    assert.equal(message.content, "invalid Mixin configuration");
    assert.deepEqual(h.notifications, []);
    assert.equal(h.vm.isMixinEnable, false);
    alert.reject();
    assert.equal(await request, false);
    assert.equal(h.vm.proxyBusy, false);
    h.vm.$destroy();
});

test("system proxy failures release the shared lock without flipping the displayed state", async () => {
    const h = model();
    const gate = deferred();
    let requests = 0;
    h.vm.$setSystemProxy = () => { requests++; return gate.promise; };
    const first = h.vm.requestSystemProxy(true);
    for (let i = 0; i < 100; i++) await h.vm.requestSystemProxy(false);
    assert.equal(requests, 1);
    gate.reject(Error("proxy command failed"));
    assert.equal(await first, false);
    assert.equal(h.vm.proxyBusy, false);
    assert.equal(h.vm.isSystemProxyOn, false);
    h.vm.$destroy();
});

test("Service Mode blocks proxy changes, background reloads and core restarts", async () => {
    const h = model();
    h.vm.serviceOperation = "applying";
    assert.equal(await h.vm.requestProfileToggle("tun", true), false);
    assert.equal(await h.vm.requestSystemProxy(true), false);
    await h.vm.refreshProfile();
    await h.vm.handlerRestartClash();
    assert.deepEqual(h.calls, []);
    assert.equal(h.vm.isTunEnable, false);
    h.vm.$destroy();
});

test("interface detection inside a profile apply cannot enqueue a second reload", () => {
    const h = model();
    h.vm.profileApplyCount = 1;
    h.vm.isDetectingProfileInterface = true;
    h.page.watch.finalInterfaceName.call(h.vm, "test-adapter");
    assert.deepEqual(h.calls, []);
    h.vm.$destroy();
});

test("an external interface change during core apply still queues the new configuration", async () => {
    const h = model();
    h.vm.profileApplyCount = 1;
    h.page.watch.finalInterfaceName.call(h.vm, "new-adapter");
    assert.equal(h.calls.length, 1);
    h.gate.resolve({ success: true });
    await Vue.nextTick();
    h.vm.$destroy();
});

test("a synchronous refresh failure cannot leave the proxy controls permanently busy", async () => {
    const h = model({ refreshRendererProfile() { throw Error("refresh unavailable"); } });
    await assert.rejects(h.vm.refreshProfile(), /refresh unavailable/);
    assert.equal(h.vm.profileApplyCount, 0);
    assert.equal(h.vm.proxyBusy, false);
    h.vm.$destroy();
});

test("TUN and Mixin shortcuts request one shared toggle instead of a second reload", async () => {
    for (const kind of ["tun", "mixin"]) {
        const h = model();
        let callback;
        const context = {
            isTunEnable: false, isMixinEnable: false,
            rebindShortcut(_next, _old, action) { callback = action; },
            requestProfileToggle: h.vm.requestProfileToggle
        };
        h.page.watch[kind === "tun" ? "settings.shortcutTun" : "settings.shortcutMixin"].call(context, "key", "old");
        const request = callback();
        await Vue.nextTick();
        assert.equal(h.calls.length, 1);
        h.gate.resolve({ success: true });
        await request;
        h.vm.$destroy();
    }
});

test("toggle displays an animated busy indicator and cannot emit changes while blocked", () => {
    for (const propsData of [{ loading: true }, { disabled: true }]) {
        const vm = new (Vue.extend(createToggle()))({ propsData: { on: true, ...propsData } });
        let changes = 0;
        vm.$on("change", () => changes++);
        for (let i = 0; i < 100; i++) vm.handleClick();
        assert.equal(changes, 0);
        const vnode = vm._render();
        assert.equal(vnode.data.attrs["aria-disabled"], "true");
        if (propsData.loading) assert.match(vnode.children[0].data.staticClass, /cfw-operation-spinner/);
        vm.$destroy();
    }
});

test("loading switches keep their dot in the target position and restore normal rendering afterwards", () => {
    for (const target of [true, false]) {
        const vm = new (Vue.extend(createToggle()))({ propsData: { on: !target, loading: true, pendingOn: target } });
        const vnode = vm._render();
        assert.equal(vm.displayedOn, target);
        assert.equal(vnode.data.class["cfw-toggle-pending"], true);
        const nodes = [], visit = node => { if (!node) return; nodes.push(node); (node.children || node.componentOptions?.children || []).forEach(visit); };
        visit(vnode);
        assert.equal(nodes.some(node => node.data?.staticClass?.includes(target ? "tint-left" : "tint-right")), true);
        assert.equal(nodes.some(node => node.data?.staticClass?.includes("cfw-toggle-spinner")), true);
        vm.loading = false;
        assert.equal(vm.displayedOn, !target);
        vm.$destroy();
    }
});

test("routing changes share the proxy lock and a rejected tray request acknowledges its own request id", async () => {
    let release;
    const messages = [];
    const h = model({ electron: { ipcRenderer: { send: (...args) => messages.push(args), invoke() {}, on() {} }, shell: {} } });
    h.vm.setMode = () => new Promise(resolve => { release = resolve; });
    const pending = h.vm.requestRoutingMode("global", 7);
    assert.equal(h.vm.proxyBusy, true);
    assert.equal(h.vm.proxyTarget, "global");
    assert.equal(await h.vm.requestProfileToggle("tun", true, 8), false);
    assert.ok(messages.some(([channel, state]) => channel === "proxy-operation-state" && state.busy && state.requestId === 8));
    release(true);
    assert.equal(await pending, true);
    assert.equal(h.vm.proxyBusy, false);
    assert.ok(messages.some(([channel, state]) => channel === "proxy-operation-state" && !state.busy && state.requestId === 7));
    h.vm.$destroy();
});

test("routing mode remains busy until connection cleanup and saved mode effects finish", async () => {
    const h = model(), cleanup = deferred();
    h.vm.settings.connMode = true;
    h.vm.profiles = { files: [], index: -1 };
    h.vm.clashApi.closeConnections = () => cleanup.promise;
    h.vm.setMode = async () => {
        h.page.watch.mode.handler.call(h.vm, "global");
        return true;
    };
    const request = h.vm.requestRoutingMode("global");
    await Vue.nextTick();
    assert.equal(h.vm.proxyBusy, true);
    assert.equal(await h.vm.requestProfileToggle("tun", true), false);
    cleanup.resolve();
    assert.equal(await request, true);
    assert.equal(h.vm.proxyBusy, false);
    h.vm.$destroy();
});

test("service progress covers the window and makes settings and title controls inert until exit", () => {
    const createElement = (tag, data, children) => ({ tag, data, children });
    for (const serviceOperation of ["applying", "restarting"]) {
        const rendered = renderHomePage.call({
            _self: { _c: createElement }, _v: value => ({ text: value }), _s: String, _e: () => ({}),
            $route: { meta: {} }, serviceOperation, serviceOperationHint: "service in progress"
        });
        const overlay = rendered.children.at(-1);
        assert.equal(overlay.data.style.inset, "0");
        assert.equal(overlay.data.attrs["aria-busy"], "true");
        assert.equal(rendered.children.find(child => child.tag === "main").data.attrs.inert, "");
        assert.equal(rendered.children.find(child => child.tag === "StatusBar").data.attrs.inert, "");
    }
});
