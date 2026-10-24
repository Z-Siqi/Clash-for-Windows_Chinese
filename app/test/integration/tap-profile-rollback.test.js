"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Vue = require("../../main/node_modules/vue");
const yaml = require("../../main/node_modules/yaml");
const { homePage } = require("../fixtures/home-page");
const { refreshProfile } = require("../../main/dist/electron/entry/renderer/refresh-profile");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function fixture(t, { rollbackStatus = 204, systemProxy = false, disconnect = true, blockRollback = false } = {}) {
    const writes = [], closed = [], alerts = [], entered = deferred(), gate = deferred();
    let active, refreshes = 0, starts = 0, failTap = true;
    const api = {
        isReady: () => true,
        async putConfig({ payload }) {
            writes.push(payload);
            if (writes.length === 3) { entered.resolve(); if (blockRollback) await gate.promise; if (rollbackStatus !== 204) return { status: rollbackStatus }; }
            active = yaml.parse(payload); return { status: 204 };
        },
        getConnections: async () => ({ status: 200, data: { connections: [
            { id: "tap", metadata: { type: "Socks5" } }, { id: "tun", metadata: { type: "TUN" } },
            { id: "http", metadata: { type: "HTTP CONNECT" } }, { id: "unknown", metadata: {} }
        ] } }),
        closeConnection: async id => { closed.push(id); return { status: 204 }; }
    };
    const dependencies = { yaml, platform: "win32", messages: {}, getLanguage: () => createTranslator(1),
        readProfileSource: async () => "dns: {enable: false}\nrules: ['MATCH,DIRECT']\n",
        profileNetworkEffects: { hasTap: async () => true }
    };
    const page = homePage({ prepareMixin: async () => {}, refreshRendererProfile(vm) { refreshes++; return refreshProfile(vm, dependencies); } });
    const vm = new Vue({ data: () => ({ ...page.data(), isTunEnable: false, isMixinEnable: false, isSystemProxyOn: systemProxy,
        isLaunching: false, isInitializing: false, settings: { legacyTapMode: "mixin", connProxyDisconnect: disconnect, mixinType: 0,
            mixinText: "mixin:\n  interface-name: Ethernet\n  dns: {enable: true, listen: ':53'}\n  rules: ['MATCH,REJECT']\n" },
        clashApi: api, confData: {}, profiles: { index: 0, files: [{ time: "plain.yaml" }] }, profilesPath: "virtual", menuItems: [], currentProfilePayload: {} }),
        computed: { proxyBusy: page.computed.proxyBusy },
        watch: { isTunEnable: page.watch.isTunEnable, isMixinEnable: page.watch.isMixinEnable, "settings.legacyTapMode": page.watch["settings.legacyTapMode"] },
        methods: { ...page.methods, updateTrayIcon() {}, resetDNS() {},
            chagneIsTunEnable({ isTun }) { this.isTunEnable = isTun; }, changeIsMixinEnable({ isMixin }) { this.isMixinEnable = isMixin; },
            setCurrentProfilePayload({ payload }) { this.currentProfilePayload = payload; }, setMenuItems({ items }) { this.menuItems = items; },
            async spawnTun2socks() { starts++; if (failTap) throw Error("fixture route unavailable"); this.tun2socks = { pid: 42 }; },
            async killSpawned() {},
            async $alert(options) { alerts.push(options); }
        }
    });
    t.after(() => vm.$destroy());
    return { vm, writes, closed, alerts, entered, gate, get active() { return active; }, get refreshes() { return refreshes; },
        get starts() { return starts; }, allowTap: () => { failTap = false; } };
}

test("failed :53 Mixin activation restores the actual core payload before turning the switch off", async t => {
    const h = fixture(t, { blockRollback: true });
    assert.equal((await h.vm.refreshProfile()).success, true);
    const request = h.vm.requestProfileToggle("mixin", true);
    await h.entered.promise;
    assert.equal(h.vm.isMixinEnable, true, "keep the accepted state visible until compensation finishes");
    assert.equal(h.vm.proxyBusy, true);
    assert.equal(h.active.dns.listen, ":53");
    h.gate.resolve();
    assert.equal(await request, false);
    assert.equal(h.vm.isMixinEnable, false);
    assert.equal(h.active.dns.enable, false);
    assert.deepEqual(h.active.rules, ["MATCH,DIRECT"]);
    assert.equal(h.writes[2], h.writes[0], "restore the exact serialized completed payload");
    assert.equal(h.vm.currentProfilePayload.dns.enable, false);
    assert.equal(h.vm.tun2socks, null);
    assert.deepEqual(h.closed.sort(), ["tap", "tun"]);
    assert.equal(h.refreshes, 2, "restoring switches must not trigger another watcher apply");
    assert.equal(h.vm.proxyBusy, false);
    assert.match(h.alerts[0].content, /fixture route unavailable/);
    h.allowTap();
    assert.equal(await h.vm.requestProfileToggle("mixin", true), true);
    assert.equal(h.vm.isMixinEnable, true);
    assert.equal(h.vm.tun2socks.pid, 42);
    assert.equal(h.starts, 2);
});

test("a failed core rollback keeps the Mixin switch aligned with the accepted core state and reports both failures", async t => {
    const h = fixture(t, { rollbackStatus: 500 });
    await h.vm.refreshProfile();
    assert.equal(await h.vm.requestProfileToggle("mixin", true), false);
    assert.equal(h.vm.isMixinEnable, true);
    assert.equal(h.active.dns.listen, ":53");
    assert.equal(h.vm.currentProfilePayload.dns.listen, ":53");
    assert.match(h.alerts[0].content, /fixture route unavailable/);
    assert.match(h.alerts[0].content, /500/);
    assert.equal(h.refreshes, 2);
    assert.equal(h.vm.proxyBusy, false);
});

test("failed TAP cleanup respects the connection preference and concurrent System Proxy traffic", async t => {
    for (const [systemProxy, disconnect, expected] of [[true, true, ["tun"]], [false, false, []]]) {
        const h = fixture(t, { systemProxy, disconnect });
        await h.vm.refreshProfile();
        await h.vm.requestProfileToggle("mixin", true);
        assert.deepEqual(h.closed, expected);
        assert.equal(h.vm.isMixinEnable, false);
    }
});

test("an initial TAP failure without a prior completed configuration cannot claim that Mixin was removed", async t => {
    const h = fixture(t);
    assert.equal(await h.vm.requestProfileToggle("mixin", true), false);
    assert.equal(h.vm.isMixinEnable, true);
    assert.equal(h.active.dns.listen, ":53");
    assert.match(h.alerts[0].content, /No previously completed configuration/);
    assert.equal(h.vm.proxyBusy, false);
});
