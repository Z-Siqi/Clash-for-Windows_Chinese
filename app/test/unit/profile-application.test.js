"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const { createProfileApplication, dnsHijackAddresses } = require("../../main/dist/electron/features/profiles/profile-application");

function harness(overrides = {}) {
    const calls = [];
    const effects = Object.fromEntries(["stopTap", "startTap", "setPayload", "setProvidersVisible", "setDns", "setDnsChanged", "resetDns", "renewDhcp", "switchMode"].map(name => [name, value => { calls.push([name, value]); }]));
    effects.detectInterface = () => "eth0";
    effects.hasTap = () => false;
    const deps = {
        fs: { readFileSync: () => "proxies: []\nrules: []" }, path, yaml, platform: "linux",
        hash: value => `hashed-${value}`, compileMixin: () => ({ parse: ({ content }) => content }),
        messages: { tunInterface: "missing TUN interface", tapInterface: "missing TAP interface" },
        clashApi: {
            putConfig: async (payload, options) => { calls.push(["put", yaml.parse(payload.payload), options]); return { status: 204, data: "" }; },
            selectProxy: async (name, now) => { calls.push(["select", name, now]); if (name === "missing") throw Error("stale"); }
        }, effects, ...overrides
    };
    return { calls, deps, apply: createProfileApplication(deps), input: {
        profiles: { index: 0, files: [{ time: "one.yaml", name: "one" }] },
        profilesPath: "/temporary/profiles", settings: {}, confData: { ipv6: false, "log-level": "warning" }
    } };
}

test("profile applies overrides, restores all groups then mode and stops TAP", async () => {
    const h = harness();
    h.input.profiles.files[0].selected = [{ name: "missing", now: "bad" }, { name: "ok", now: "DIRECT" }];
    h.input.profiles.files[0].mode = "rule";
    assert.deepEqual(await h.apply(h.input), { success: true, message: null });
    assert.deepEqual(h.calls.map(call => call[0]), ["put", "setPayload", "setProvidersVisible", "resetDns", "select", "select", "switchMode", "stopTap"]);
    assert.equal(h.calls[0][1]["log-level"], "warning");
    assert.equal(h.calls[0][1].ipv6, false);
    assert.equal(h.calls[0][2].timeout, 10000);
    assert.equal(h.calls[1][1].ipv6, undefined);
});

test("TUN then async code mixin, secured HTTP providers and file aliases", async () => {
    const h = harness({ compileMixin: () => ({ async parse({ content, url, name }) {
        assert.equal(content.tun.enable, true); assert.equal(url, ""); assert.equal(name, "one");
        return { ...content, "proxy-providers": { http: { type: "http", url: "proxy", path: "original" }, alias: { type: "file", path: "original" } }, "rule-providers": { rules: { "<<": { type: "http", url: "rules" }, path: "old" } } };
    } }) });
    h.input.mixinEnabled = true; h.input.settings = { mixinType: 1, mixinCode: "code" };
    h.input.tunConfig = { tun: { enable: true, "dns-hijack": ["any:53"] } };
    assert.equal((await h.apply(h.input)).success, true);
    assert.equal(h.calls[0][2].timeout, 0);
    assert.equal(h.calls[0][1]["proxy-providers"].alias.path, "./providers/proxy/hashed-proxy.yaml");
    assert.equal(h.calls[0][1]["rule-providers"].rules.path, "./providers/rule/hashed-rules.yaml");
    assert.deepEqual(h.calls.find(c => c[0] === "setDns")[1], ["8.8.8.8"]);
});

test("YAML mixin overrides TUN; malformed optional mixin retains profile", async () => {
    const h = harness(); h.input.mixinEnabled = true;
    h.input.tunConfig = { tun: { enable: true } };
    h.input.settings.mixinText = "mixin:\n  tun:\n    enable: false";
    assert.equal((await h.apply(h.input)).success, true);
    assert.equal(h.calls[0][1].tun.enable, false);
    h.input.settings.mixinText = "[invalid";
    assert.equal((await h.apply(h.input)).success, true);
});

test("rejected config cannot trigger DNS, TAP, menus or selection side effects", async () => {
    const h = harness({ clashApi: { putConfig: async () => ({ status: 400, data: { message: "invalid config" } }) } });
    assert.deepEqual(await h.apply(h.input), { success: false, message: "invalid config" });
    assert.deepEqual(h.calls, [["setPayload", {}]]);
});

test("read, parse, mixin and transport failures return errors without applying side effects", async () => {
    for (const overrides of [
        { fs: { readFileSync() { throw Error("missing file"); } } },
        { fs: { readFileSync: () => "[broken" } },
        { fs: { readFileSync: () => "null" } },
        { compileMixin: () => ({ parse: async () => null }) },
        { clashApi: { putConfig: async () => { throw Error("offline"); } } }
    ]) {
        const h = harness(overrides); h.input.mixinEnabled = true; h.input.settings = { mixinType: 1, mixinCode: "code" };
        const result = await h.apply(h.input);
        assert.equal(result.success, false); assert.match(result.message, /^Error:/); assert.deepEqual(h.calls, []);
    }
});

test("no selection stops old TAP; missing selected entry is reported", async () => {
    const h = harness(); h.input.profiles.index = -1;
    assert.deepEqual(await h.apply(h.input), { success: false, message: null });
    assert.deepEqual(h.calls, [["stopTap", undefined]]);
    h.input.profiles.index = 9;
    assert.match((await h.apply(h.input)).message, /does not exist/);
});

test("Windows TUN requires an interface unless automatic detection is enabled", async () => {
    const h = harness({ platform: "win32" }); h.deps.effects.detectInterface = () => "";
    h.input.tunConfig = { tun: { enable: true } };
    assert.equal((await h.apply(h.input)).message, "missing TUN interface"); assert.deepEqual(h.calls, []);
    h.input.tunConfig.tun["auto-detect-interface"] = true;
    assert.equal((await h.apply(h.input)).success, true);
});

test("Windows TAP DNS listener activates TAP after a successful apply", async () => {
    const h = harness({ platform: "win32", fs: { readFileSync: () => "dns:\n  enable: true\n  listen: 0.0.0.0:53" } });
    h.deps.effects.hasTap = () => true;
    assert.equal((await h.apply(h.input)).success, true);
    assert.equal(h.calls[0][1]["interface-name"], "eth0");
    assert.equal(h.calls.at(-1)[0], "startTap");
});

test("DNS hijacks preserve supported IPv4 and any forms", () => {
    assert.deepEqual(dnsHijackAddresses(["any:53", "1.1.1.1", "2.2.2.2:53", "3.3.3.3:54", "example:53"]), ["8.8.8.8", "1.1.1.1", "2.2.2.2"]);
});

test("missing General configuration does not prevent applying a valid profile", async () => {
    const h = harness(); h.input.confData = null;
    assert.equal((await h.apply(h.input)).success, true);
});

test("renderer refreshes serialize async mixins and recover after a failed apply", async () => {
    const { refreshProfile } = require("../../main/dist/electron/entry/renderer/refresh-profile");
    let release; let started;
    const entered = new Promise(resolve => { started = resolve; });
    let count = 0; const payloads = [];
    const model = {
        profilesPath: "temporary", profiles: { index: 0, files: [{ time: "one" }] },
        settings: { mixinType: 1, mixinCode: "mixin" }, isMixinEnable: true, menuItems: [], confData: {},
        clashApi: { async putConfig(body) { payloads.push(yaml.parse(body.payload)); return { status: 204 }; } },
        setCurrentProfilePayload() {}, setMenuItems() {}, resetDNS() {}, killSpawned() {}
    };
    const dependencies = {
        platform: "linux", fs: { readFileSync: () => "rules: []" }, path, yaml, messages: { providers: "Providers" },
        compileMixin: () => ({ async parse({ content }) {
            const number = ++count;
            if (number === 1) { started(); await new Promise(resolve => { release = resolve; }); }
            if (number === 2) throw Error("mixin failed");
            return { ...content, number };
        } })
    };
    const first = refreshProfile(model, dependencies); await entered;
    const second = refreshProfile(model, dependencies); const third = refreshProfile(model, dependencies);
    assert.equal(count, 1); release();
    const results = await Promise.all([first, second, third]);
    assert.deepEqual(results.map(value => value.success), [true, false, true]);
    assert.deepEqual(payloads.map(value => value.number), [1, 3]);
});
