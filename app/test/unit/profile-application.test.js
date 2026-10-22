"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const { createProfileApplication, dnsHijackAddresses } = require("../../main/dist/electron/features/profiles/profile-application");
const { normalizeLegacyDnsFilters } = require("../../main/dist/electron/features/profiles/prepare-profile");
const { createTranslator } = require("../../main/dist/electron/core/i18n/language");

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
    assert.deepEqual(h.calls.map(call => call[0]), ["put", "setPayload", "setProvidersVisible", "select", "select", "switchMode", "resetDns", "stopTap"]);
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

test("saved legacy Mixin DNS filters are repaired in the applied payload without changing saved text", async () => {
    const h = harness();
    h.input.mixinEnabled = true;
    const text = 'mixin:\n  dns:\n    enable: true\n    fake-ip-filter:\n      - " *.n.n.srv.nintendo.net"\n      - "custom.example"\n';
    h.input.settings.mixinText = text;
    assert.equal((await h.apply(h.input)).success, true);
    assert.deepEqual(h.calls[0][1].dns["fake-ip-filter"], ["*.n.n.srv.nintendo.net", "custom.example"]);
    assert.equal(h.input.settings.mixinText, text);
});

test("legacy DNS normalization preserves original objects and unrelated custom filters", () => {
    const input = { dns: { "fake-ip-filter": [" *.n.n.srv.nintendo.net", " custom.example", "/regex/", null] } };
    const normalized = normalizeLegacyDnsFilters(input);
    assert.deepEqual(normalized.dns["fake-ip-filter"], ["*.n.n.srv.nintendo.net", " custom.example", "/regex/", null]);
    assert.equal(input.dns["fake-ip-filter"][0], " *.n.n.srv.nintendo.net");
    assert.equal(normalizeLegacyDnsFilters(normalized), normalized);
});

test("rejected config cannot trigger DNS, TAP, menus or selection side effects", async () => {
    const h = harness({ clashApi: { putConfig: async () => ({ status: 400, data: { message: "invalid config" } }) } });
    assert.deepEqual(await h.apply(h.input), { success: false, message: "invalid config" });
    assert.deepEqual(h.calls, []);
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

test("invalid profile values, Mixin results and owned apply errors follow the current language", async () => {
    let language = 0, source;
    const labels = createTranslator(() => language);
    const h = harness({ getLanguage: () => labels, fs: { readFileSync: () => source } });
    for (language of [0, 1, 0]) {
        for (source of ["invalid configuration", "null", "", "[]", "42"]) {
            assert.deepEqual(await h.apply(h.input), { success: false,
                message: labels.profileApplyError({ reason: labels.profileNotMapping(), location: "" }) });
            assert.deepEqual(h.calls, []);
        }
        source = "rules: []";
        h.input.profiles.index = 9;
        assert.equal((await h.apply(h.input)).message, labels.profileApplyError({ reason: labels.selectedProfileMissing(), location: "" }));
        h.input.profiles.index = 0;
        h.input.mixinEnabled = true;
        h.input.settings = { mixinType: 1, mixinCode: "invalid mixin" };
        const mixin = harness({ getLanguage: () => labels, compileMixin: () => ({ parse: () => null }) });
        assert.equal((await mixin.apply(h.input)).message, labels.profileApplyError({ reason: labels.mixinNotMapping(), location: "" }));
        h.input.mixinEnabled = false;
        const rejected = harness({ getLanguage: () => labels, clashApi: { putConfig: async () => ({ status: 400, data: {} }) } });
        assert.equal((await rejected.apply(rejected.input)).message, labels.profileSwitchStatus({ status: 400 }));
    }
});

test("YAML errors add localized context and position while preserving parser and core diagnostics", async () => {
    for (const language of [0, 1]) {
        const labels = createTranslator(language);
        const parse = harness({ getLanguage: () => labels, fs: { readFileSync: () => "rules: [\n" } });
        const error = (() => { try { yaml.parse("rules: [\n", { prettyErrors: true, strict: false }); } catch (error) { return error; } })();
        const result = await parse.apply(parse.input);
        assert.ok(result.message.includes(labels.profileInvalidYaml()));
        assert.ok(result.message.includes(error.message));
        assert.ok(result.message.includes(labels.profileErrorLocation({ line: error.linePos[0].line, column: error.linePos[0].col })));
        assert.deepEqual(parse.calls, []);
        const raw = "core-specific validation diagnostic";
        const core = harness({ getLanguage: () => labels, clashApi: { putConfig: async () => ({ status: 400, data: { message: raw } }) } });
        assert.deepEqual(await core.apply(core.input), { success: false, message: raw });
        assert.deepEqual(core.calls, []);
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
    h.input.settings.legacyTapMode = "enabled";
    assert.equal((await h.apply(h.input)).success, true);
    assert.equal(h.calls[0][1]["interface-name"], "eth0");
    assert.equal(h.calls.at(-1)[0], "startTap");
});

test("explicit legacy TAP opt-out skips adapter detection and stops TAP without changing DNS", async () => {
    const h = harness({ platform: "win32", fs: { readFileSync: () => "dns:\n  enable: true\n  listen: :53" } });
    h.input.settings.legacyTapMode = "disabled";
    h.deps.effects.hasTap = () => assert.fail("opt-out must not query installed adapters");
    h.deps.effects.detectInterface = () => assert.fail("opt-out must not detect a route");
    assert.equal((await h.apply(h.input)).success, true);
    assert.equal(h.calls[0][1].dns.listen, ":53");
    assert.equal(h.calls.at(-1)[0], "stopTap");
});

test("DNS hijacks preserve supported IPv4 and any forms", () => {
    assert.deepEqual(dnsHijackAddresses(["any:53", "1.1.1.1", "2.2.2.2:53", "3.3.3.3:54", "example:53"]), ["8.8.8.8", "1.1.1.1", "2.2.2.2"]);
});

test("absent TAP prepares the authorized physical interface but never starts an absent adapter", async () => {
    const h = harness({ platform: "win32", fs: { readFileSync: () => "dns:\n  enable: true\n  listen: 0.0.0.0:53" } });
    h.input.settings.legacyTapMode = "enabled";
    h.deps.effects.hasTap = async () => false;
    assert.equal((await h.apply(h.input)).success, true);
    assert.equal(h.calls.at(-1)[0], "stopTap");
    assert.equal(h.calls[0][1]["interface-name"], "eth0");
    assert.equal(h.calls.some(call => call[0] === "startTap"), false);
});

test("an authorized profile still loads offline when TAP is absent and there is no upstream interface", async () => {
    const h = harness({ platform: "win32", fs: { readFileSync: () => "dns:\n  enable: true\n  listen: ':53'" } });
    h.input.settings.legacyTapMode = "enabled";
    h.deps.effects.hasTap = async () => false;
    h.deps.effects.detectInterface = async () => null;
    assert.equal((await h.apply(h.input)).success, true);
    assert.equal(h.calls.some(call => call[0] === "startTap"), false);
    assert.equal(h.calls[0][1]["interface-name"], undefined);
});

test("async DNS failure is caught before reporting DNS ownership", async () => {
    const h = harness();
    h.input.tunConfig = { tun: { enable: true, "dns-hijack": ["any:53"] } };
    h.deps.effects.setDns = async () => { throw new Error("DNS rejected"); };
    assert.equal((await h.apply(h.input)).success, true);
    assert.deepEqual(h.calls.find(call => call[0] === "setDnsChanged"), ["setDnsChanged", false]);
});

test("missing General configuration does not prevent applying a valid profile", async () => {
    const h = harness(); h.input.confData = null;
    assert.equal((await h.apply(h.input)).success, true);
});

test("Windows profiles without a DNS listener skip synchronous TAP discovery", async () => {
    const h = harness({ platform: "win32" });
    h.deps.effects.hasTap = () => { throw Error("must not query adapters"); };
    assert.equal((await h.apply(h.input)).success, true);
});

test("profile timing separates preparation, core application and network effects without configuration data", async () => {
    const timings = [];
    const h = harness({ onTiming: (...args) => timings.push(args) });
    assert.equal((await h.apply(h.input)).success, true);
    assert.deepEqual(timings.map(([name]) => name), ["prepare", "core-config", "network-effects", "total"]);
    assert.ok(timings.every(([, ms]) => Number.isFinite(ms) && ms >= 0));
});

test("a failed timing sink cannot change a successful apply", async () => {
    const h = harness({ onTiming: () => { throw Error("logger unavailable"); } });
    assert.equal((await h.apply(h.input)).success, true);
});

test("renderer interface discovery suppresses only its own watcher flush and releases on failure", async () => {
    const { refreshProfile } = require("../../main/dist/electron/entry/renderer/refresh-profile");
    for (const fail of [false, true]) {
        const model = {
            profilesPath: "temporary", profiles: { index: 0, files: [{ time: "one" }] },
            settings: {}, confData: {}, menuItems: [],
            clashApi: { putConfig: async () => ({ status: 204 }) },
            async detectInterfaceName() {
                assert.equal(this.isDetectingProfileInterface, true);
                if (fail) throw Error("discovery failed");
                this.finalInterfaceName = "test-adapter";
            },
            async $nextTick() { assert.equal(this.isDetectingProfileInterface, true); },
            setCurrentProfilePayload() {}, setMenuItems() {}, killSpawned() {}
        };
        const result = await refreshProfile(model, {
            platform: "win32", path, yaml,
            fs: { readFileSync: () => "tun:\n  enable: true\n" },
            profileNetworkEffects: {}, messages: {}
        });
        assert.equal(result.success, !fail);
        assert.equal(model.isDetectingProfileInterface, false);
    }
});

test("renderer refreshes retire obsolete async mixins and recover after the latest apply fails", async () => {
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
    const { readStableProfileState } = require("../../main/dist/electron/core/network/profile-refresh-state");
    let selectionRead = false;
    const reading = readStableProfileState(model.clashApi, async () => {
        selectionRead = true;
        return payloads.at(-1)?.number || 0;
    });
    await Promise.resolve();
    assert.equal(selectionRead, false);
    assert.equal(count, 1); release();
    const results = await Promise.all([first, second, third]);
    assert.deepEqual(results.map(value => value.success), [false, false, false]);
    assert.deepEqual(results.map(value => value.superseded === true), [true, true, false]);
    assert.match(results[2].message, /mixin failed/);
    assert.deepEqual(payloads, []);
    assert.equal(await reading, 0);
    assert.equal((await refreshProfile(model, dependencies)).success, true);
    assert.deepEqual(payloads.map(value => value.number), [3]);
});
