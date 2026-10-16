"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const cloneDeep = require("../../main/node_modules/lodash/cloneDeep");
const { createSettingsRepository } = require("../../main/dist/electron/features/settings/settings-repository");
const { createProfilesRepository } = require("../../main/dist/electron/features/profiles/profiles-repository");
const { createSettingsProxy } = require("../../main/dist/electron/features/settings/settings-proxy");
const { updateYamlValue } = require("../../main/dist/electron/core/storage/yaml-file");
const { createJsonCache } = require("../../main/dist/electron/core/storage/json-cache");

test("atomic settings writes preserve existing data on rename failure and remove temporary files", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-settings-"));
    try {
        const repo = createSettingsRepository({ fs, path, yaml });
        repo.save(home, { proxyCore: "clash", custom: [1], randomMixedPort: false });
        const before = fs.readFileSync(path.join(home, "cfw-settings.yaml"), "utf8");
        const failing = createSettingsRepository({ fs: { ...fs, renameSync() { throw Error("locked"); } }, path, yaml });
        assert.throws(() => failing.save(home, { proxyCore: "mihomo" }), /locked/);
        assert.equal(fs.readFileSync(path.join(home, "cfw-settings.yaml"), "utf8"), before);
        assert.deepEqual(fs.readdirSync(home), ["cfw-settings.yaml"]);
        assert.equal(repo.load(home).proxyCore, "clash");
        assert.throws(() => repo.save("", {}), /not initialized/);
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test("settings proxies preserve concurrent edits and do not publish failed saves", () => {
    let settings = { first: 0, second: 0, nested: { value: 1 } };
    let fail = false;
    const make = () => createSettingsProxy({ getSettings: () => settings, cloneDeep, saveSettings: value => { if (fail) throw Error("disk"); settings = value; } });
    const a = make(), b = make();
    a.first = 1; b.second = 2;
    assert.deepEqual(settings, { first: 1, second: 2, nested: { value: 1 } });
    a.nested.value = 3;
    assert.equal(settings.nested.value, 1);
    fail = true; assert.throws(() => { b.second = 9; }, /disk/);
    assert.equal(settings.second, 2); assert.equal(b.second, 2);
});

test("profile lists round-trip YAML aliases and reject invalid list shapes", () => {
    const repo = createProfilesRepository({ fs: { readFileSync: () => "files: []\nindex: -1" }, path, yaml });
    assert.deepEqual(repo.load("temporary"), { files: [], index: -1 });
    const bad = createProfilesRepository({ fs: { readFileSync: () => "null" }, path, yaml });
    assert.throws(() => bad.load("temporary"), /Invalid profiles/);
});

test("YAML updates preserve comments and manual ports, and never replace malformed YAML", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-yaml-"));
    try {
        const file = path.join(home, "config.yaml");
        fs.writeFileSync(file, "# user comment\nmixed-port: 7891\nmode: direct\n");
        updateYamlValue({ fs, path, yaml, file, key: "mode", value: "rule" });
        const data = fs.readFileSync(file, "utf8");
        assert.match(data, /# user comment/); assert.equal(yaml.parse(data)["mixed-port"], 7891);
        fs.writeFileSync(file, "[broken");
        assert.throws(() => updateYamlValue({ fs, path, yaml, file, key: "mode", value: "rule" }));
        assert.equal(fs.readFileSync(file, "utf8"), "[broken");
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test("JSON preferences handle missing/corrupt entries without logging their contents", () => {
    const values = new Map();
    const cache = createJsonCache({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
    assert.equal(cache.get("missing"), null);
    values.set("bad", "broken"); assert.equal(cache.get("bad"), undefined);
    cache.put("setting", { enabled: false }); assert.deepEqual(cache.get("setting"), { enabled: false });
});

test("invalid settings document shapes fall back to defaults", () => {
    for (const source of ["null", "3", "- item", "[broken"]) {
        const repo = createSettingsRepository({ fs: { readFileSync: () => source }, path, yaml });
        const settings = repo.load("temporary");
        assert.equal(settings.proxyCore, "mihomo");
        assert.equal(settings.randomControllerPort, true);
        assert.equal(settings[0], undefined);
    }
});
