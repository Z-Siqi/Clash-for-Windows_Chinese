"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const yaml = require("../../main/node_modules/yaml");
const { bundledRefresh } = require("../fixtures/bundled-refresh");
const { buildStore } = require("../fixtures/renderer-store");
const { profilePage } = require("../fixtures/profile-pages");
const { rendererLanguage } = require("../fixtures/renderer-harness");

test("Application: production refresh adapter reads disk, applies config, updates state and restores selection", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-profile-app-"));
    try {
        fs.writeFileSync(path.join(home, "profile.yaml"), "proxies: []\nproxy-groups: []\nrules: []\n");
        const events = [];
        const model = {
            profilesPath: home, profiles: { index: 0, files: [{ time: "profile.yaml", mode: "direct", selected: [{ name: "group", now: "DIRECT" }] }] },
            confData: { ipv6: false, "log-level": "warning" }, settings: {}, menuItems: [{ title: "Providers" }],
            clashApi: { async putConfig(body) { events.push("apply"); assert.equal(yaml.parse(body.payload)["log-level"], "warning"); return { status: 204 }; }, async selectProxy() { events.push("select"); } },
            setCurrentProfilePayload({ payload }) { this.payload = payload; },
            setMenuItems({ items }) { this.menuItems = items; }, resetDNS() { events.push("resetDNS"); },
            switchMode(mode) { events.push(mode); }, killSpawned() { events.push("stopTAP"); }
        };
        const refresh = bundledRefresh("linux");
        assert.equal((await refresh.call(model)).success, true);
        assert.deepEqual(events, ["apply", "resetDNS", "select", "direct", "stopTAP"]);
        assert.equal(model.menuItems.length, 0); assert.deepEqual(model.payload.rules, []);
        fs.writeFileSync(path.join(home, "profile.yaml"), "[broken");
        const previous = events.length;
        assert.equal((await refresh.call(model)).success, false);
        assert.equal(events.length, previous);
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

for (const locale of [0, 1]) {
    test(`Application: locale ${locale} reports YAML syntax errors and clears failed selection via the click handler`, async t => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-selection-"));
        t.after(() => fs.rmSync(home, { recursive: true, force: true }));
        fs.writeFileSync(path.join(home, "list.yml"), "index: -1\nfiles:\n  - time: broken.yaml\n");
        fs.writeFileSync(path.join(home, "broken.yaml"), "proxy-groups: [\n");
        const { store } = buildStore({ home }); store.commit("LOAD_PROFILES");
        let apiCalls = 0;
        const parent = {
            profilesPath: home, get profiles() { return store.state.app.profiles; },
            settings: {}, confData: {},
            clashApi: { putConfig() { apiCalls++; throw Error("invalid YAML must not reach the core"); } }
        };
        parent.refreshProfile = bundledRefresh("linux", locale).bind(parent);
        const dialogs = [];
        const page = profilePage({ store, parent, dialogs, locale });
        await page.handleProfileClick(0);
        assert.equal(apiCalls, 0); assert.equal(dialogs.length, 1);
        assert.equal(dialogs[0].message, new (rendererLanguage())(locale).couldNotSwitchProfile());
        assert.match(dialogs[0].detail, /Error:/);
        assert.equal(store.state.app.profiles.index, -1);
        assert.equal(page.loadingProfileIndex.length, 0);
    });

    test(`Application: locale ${locale} reports a missing TAP interface with the real translations`, async t => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-tap-message-"));
        t.after(() => fs.rmSync(home, { recursive: true, force: true }));
        fs.writeFileSync(path.join(home, "profile.yaml"), "dns:\n  enable: true\n  listen: 0.0.0.0:53\n");
        const result = await bundledRefresh("win32", locale).call({
            profilesPath: home, profiles: { index: 0, files: [{ time: "profile.yaml" }] }, settings: {},
            detectInterfaceName() {}, finalInterfaceName: "",
            clashApi: { putConfig() { throw Error("must not apply without an interface"); } }
        });
        assert.equal(result.success, false);
        assert.equal(result.message, new (rendererLanguage())(locale).modeTAPEnableNoINthisYAML());
        assert.match(result.message, locale === 0 ? /接口名称/ : /interface-name/);
    });
}

test("Application: unexpected refresh failures are visible and cannot leave a false selection", async t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-refresh-failure-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    fs.writeFileSync(path.join(home, "list.yml"), "index: -1\nfiles:\n  - time: profile.yaml\n");
    const { store } = buildStore({ home }); store.commit("LOAD_PROFILES");
    for (const fail of [() => { throw Error("refresh initialization failed"); }, () => Promise.reject(Error("refresh initialization failed"))]) {
        const dialogs = [];
        const page = profilePage({ store, parent: { refreshProfile: fail }, dialogs });
        await page.handleProfileClick(0);
        assert.equal(dialogs.length, 1);
        assert.equal(dialogs[0].type, "error");
        assert.equal(dialogs[0].detail, "refresh initialization failed");
        assert.equal(store.state.app.profiles.index, -1);
        assert.equal(page.loadingProfileIndex.length, 0);
    }
});
