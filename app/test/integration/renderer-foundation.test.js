"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vmModule = require("node:vm");
const { createRequire } = require("node:module");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const Router = require("../../main/node_modules/vue-router");
const { createRendererRouter } = require("../../main/dist/electron/features/renderer-ui/router");
const { createApplicationComponent, createDialogPlugin } = require("../../main/dist/electron/features/renderer-ui/application");
const { createGlobalMixin } = require("../../main/dist/electron/entry/renderer/global-mixin");
const { rendererPath } = require("../fixtures/renderer-harness");

test("Renderer foundation: real Vue router preserves every page, fallback and keep-alive policy", async () => {
    const pages = Object.fromEntries(["home", "general", "proxy", "provider", "log", "server", "connection", "router", "setting", "about"]
        .map(name => [name, { name, render: h => h("div") }]));
    const router = createRendererRouter({ Vue, Router, pages });
    for (const name of Object.keys(pages).filter(name => name !== "home")) {
        await router.push(`/home/${name}`);
        assert.equal(router.currentRoute.matched[0].components.default, pages.home);
        assert.equal(router.currentRoute.matched[1].components.default, pages[name]);
        assert.equal(!!router.currentRoute.meta.keepAlive, name !== "log");
    }
    await router.push("/unknown");
    assert.equal(router.currentRoute.path, "/home/general");
});

test("Renderer foundation: real Vue reacts to theme and renders the route outlet without a template compiler", async () => {
    const document = { body: { className: "" } };
    const vm = new Vue({ ...createApplicationComponent({ document }), router: new Router({ routes: [] }), data: () => ({ theme: "light" }) });
    assert.equal(document.body.className, "theme-light");
    vm.theme = "dark";
    await Vue.nextTick();
    assert.equal(document.body.className, "theme-dark");
    const vnode = vm._render();
    assert.equal(vnode.tag, "div");
    assert.equal(vnode.data.attrs.id, "app");
    vm.$destroy();
});

test("Renderer foundation: shared mixin restores both DOM and component scroll references and sequences restart IPC", async () => {
    const scheduled = [], calls = [];
    const mixin = createGlobalMixin({ Vuex, platform: "win32", schedule: cb => scheduled.push(cb), ipcRenderer: {
        invoke: async (...args) => { calls.push(args); }
    } });
    for (const wrapped of [false, true]) {
        const element = { style: {}, scrollTop: 43 };
        const vm = { $refs: { "mixin-scroll-content": wrapped ? { $el: element } : element }, $nextTick: cb => cb() };
        let left = false;
        mixin.beforeRouteLeave.call(vm, {}, {}, () => { left = true; });
        assert.equal(left, true);
        element.scrollTop = 0;
        mixin.beforeRouteEnter({}, {}, cb => cb(vm));
        assert.equal(element.scrollTop, 43);
        assert.equal(element.style.scrollBehavior, "auto");
        scheduled.shift()();
        assert.equal(element.style.scrollBehavior, "smooth");
    }
    mixin.beforeRouteEnter({}, {}, cb => cb({ $refs: {} }));
    await mixin.methods.reloadElectron();
    assert.deepEqual(calls, [["app", "relaunch"], ["app", "exit", 0]]);
    assert.equal(mixin.computed.isWindows(), true);
});

test("Renderer foundation: singleton dialogs receive the store and expose bound show methods", async () => {
    const appended = [], store = { marker: true };
    // Node Vue has no DOM patcher; exercise the real constructor/binding with a mount adapter.
    const LocalVue = Vue.extend();
    LocalVue.prototype.$mount = function() { this.$el = { instance: this }; return this; };
    createDialogPlugin({ document: { body: { appendChild: el => appended.push(el) } }, components: {
        alert: { data: () => ({ count: 0 }), methods: { show() { return ++this.count; } } },
        toast: { methods: { show(value) { return value; } } }
    } }).install(LocalVue, { store });
    assert.equal(appended.length, 2);
    assert.equal(appended[0].instance.$options.store, store);
    assert.equal(LocalVue.prototype.$alert(), 1);
    assert.equal(LocalVue.prototype.$alert(), 2);
    assert.equal(LocalVue.prototype.$toast("saved"), "saved");
    for (const el of appended) el.instance.$destroy();
});

test("Renderer foundation: production entry delegates bootstrap without duplicate owners", () => {
    const source = fs.readFileSync(path.join(path.dirname(rendererPath), "entry/renderer/start-renderer.js"), "utf8");
    for (const call of ["createRendererRouter({", "createRendererCapabilities({", "mountRendererApplication({"])
        assert.equal(source.includes(call), true, call);
    for (const old of ["class Language {", "mixinScrollTop: 0", "e.prototype.$setAutoLaunch", "e.prototype.$getTrayIcon", "h.ZP.mixin({", 'template: "<App/>"'])
        assert.equal(source.includes(old), false, old);
    const entry = fs.readFileSync(path.join(path.dirname(rendererPath), "entry/renderer/mount-application.js"), "utf8");
    assert.match(entry, /Vue\.mixin\(createGlobalMixin\(deps\)\)/);
});

test("Renderer foundation: production bootstrap composes all dialog and capability plugins and mounts the routed app", () => {
    const source = fs.readFileSync(path.join(path.dirname(rendererPath), "entry/renderer/start-renderer.js"), "utf8");
    for (const call of [
        "createRendererRuntime({", "createSharedComponents({", "createRendererPages({",
        "createRendererRouter({", "createRendererCapabilities({", "mountRendererApplication({"
    ]) assert.equal(source.includes(call), true, call);
    assert.match(source, /dialogs: components\.dialogs/);
    assert.match(source, /plugins: \[capabilities\]/);
    assert.match(source, /electronPlugin: process\.env\.IS_WEB \? null : electronPlugin/);
});
