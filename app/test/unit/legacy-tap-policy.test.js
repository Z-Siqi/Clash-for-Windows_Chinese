"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const { resolveTapMode, isTapDns } = require("../../main/dist/electron/core/network/legacy-tap-policy");
const { mergeSettings } = require("../../main/dist/electron/features/settings/settings-defaults");
const { createProfileApplication } = require("../../main/dist/electron/features/profiles/profile-application");

test("TAP defaults and migration restrict former automatic startup while preserving explicit opt-out and new choices", () => {
    for (const settings of [{}, { legacyTapEnabled: true }, { legacyTapMode: "unknown" }]) {
        assert.equal(resolveTapMode(settings), "mixin");
        assert.equal(mergeSettings(settings).legacyTapMode, "mixin");
    }
    assert.equal(resolveTapMode({ legacyTapEnabled: false }), "disabled");
    assert.equal(Object.hasOwn(mergeSettings({ legacyTapEnabled: false }), "legacyTapEnabled"), false);
    for (const legacyTapMode of ["enabled", "mixin", "disabled"]) {
        assert.equal(resolveTapMode({ legacyTapMode, legacyTapEnabled: false }), legacyTapMode);
    }
    for (const dns of [{ enable: "true", listen: ":53" }, { enable: true, listen: "127.0.0.1:53" }, { enable: true, listen: "::53" }, { enable: true, listen: ":5353" }]) assert.equal(isTapDns(dns), false);
});

function application({ source = "dns:\n  enable: true\n  listen: :53\n", settings = {}, mixinEnabled = false, transform, platform = "win32", installed = true, status = 204 } = {}) {
    const events = [], payloads = [];
    const apply = createProfileApplication({ path, yaml, platform, fs: { readFileSync: () => source }, messages: {}, hash: String,
        runMixin: async payload => { assert.equal(Object.hasOwn(payload.content, "cfw-tap"), false); return transform(payload.content); },
        clashApi: { putConfig: async ({ payload }) => { payloads.push(yaml.parse(payload)); return { status, data: { message: "rejected" } }; } },
        effects: {
            hasTap: async () => { events.push("check-adapter"); return installed; }, detectInterface: async () => "test-adapter",
            setPayload() {}, setProvidersVisible() {}, resetDns() {}, setDns() {}, setDnsChanged() {}, renewDhcp() {},
            startTap: async () => events.push("start"), stopTap: async () => events.push("stop")
        }
    });
    return { events, payloads, run: () => apply({ profiles: { index: 0, files: [{ time: "test.yaml" }] }, profilesPath: "/temporary", settings, mixinEnabled }) };
}

test("subscription :53 and authorization markers cannot start default Mixin-only TAP", async () => {
    for (const mixinText of [undefined, "mixin: {}", "mixin:\n  rules: []", "mixin:\n  dns:\n    enable: true", "mixin:\n  dns:\n    listen: :53", "[invalid"]) {
        const app = application({ source: 'cfw-tap: true\ndns:\n  enable: true\n  listen: :53', settings: { mixinText }, mixinEnabled: true });
        assert.equal((await app.run()).success, true);
        assert.deepEqual(app.events, ["stop"]);
        assert.equal(Object.hasOwn(app.payloads[0], "cfw-tap"), false);
    }
});

test("only locally declared YAML DNS or explicit JavaScript consent can authorize restricted TAP", async () => {
    const mixinText = "mixin:\n  dns:\n    enable: true\n    listen: :53";
    for (const mode of ["enabled", "mixin", "disabled"]) for (const mixinEnabled of [true, false]) {
        const app = application({ settings: { legacyTapMode: mode, mixinText }, mixinEnabled });
        assert.equal((await app.run()).success, true);
        assert.equal(app.events.includes("start"), mode === "enabled" || (mode === "mixin" && mixinEnabled));
    }
    for (const consent of [undefined, false, "true", true]) {
        const app = application({ source: 'cfw-tap: true\ndns:\n  enable: true\n  listen: :53',
            settings: { mixinType: 1, mixinCode: "local" }, mixinEnabled: true,
            transform: content => ({ ...content, ...(consent === undefined ? {} : { "cfw-tap": consent }) }) });
        assert.equal((await app.run()).success, true);
        assert.equal(app.events.includes("start"), consent === true);
        assert.equal(Object.hasOwn(app.payloads[0], "cfw-tap"), false);
    }
});

test("TAP permission cannot bypass native TUN, adapter presence, DNS eligibility, core validation or platform", async () => {
    for (const options of [
        { source: "tun:\n  enable: true\n  auto-detect-interface: true\ndns:\n  enable: true\n  listen: :53" },
        { installed: false }, { platform: "linux" }, { platform: "darwin" },
        { source: "dns:\n  enable: false\n  listen: :53" }, { source: "dns:\n  enable: true\n  listen: 127.0.0.1:53" }, { status: 400 }
    ]) {
        const app = application({ ...options, settings: { legacyTapMode: "enabled" } });
        await app.run();
        assert.equal(app.events.includes("start"), false);
        if (options.status === 400) assert.equal(app.events.includes("stop"), false);
    }
});
