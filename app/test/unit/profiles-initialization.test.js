"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const yaml = require("../../main/node_modules/yaml");
const { createProfilesRepository } = require("../../main/dist/electron/features/profiles/profiles-repository");

function fixture(t, fileSystem = fs) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-initial-profiles-"));
    t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
    return { folder, repo: createProfilesRepository({ fs: fileSystem, path, yaml }) };
}

test("fresh and previously empty lists receive one selected local default before startup apply", t => {
    for (const existing of [false, true]) {
        const { folder, repo } = fixture(t);
        if (existing) repo.initialize(folder);
        const source = "# preserved source\nmixed-port: 7894\nrules: ['MATCH,DIRECT']\n";
        repo.initialize(folder, () => source);
        const list = repo.load(folder);
        assert.equal(list.index, 0);
        assert.equal(list.files.length, 1);
        assert.deepEqual({ ...list.files[0], time: "generated" }, { name: "config.yaml", url: "", time: "generated", selected: [] });
        assert.equal(fs.readFileSync(path.join(folder, list.files[0].time), "utf8"), source);
        repo.initialize(folder, () => assert.fail("existing profiles must not be copied again"));
        assert.deepEqual(repo.load(folder), list);
    }
});

test("startup preserves existing profile bytes, order and an explicitly absent selection", t => {
    const { folder, repo } = fixture(t);
    repo.initialize(folder);
    const files = [{ name: "first", time: "1.yml" }, { name: "second", time: "2.yml" }];
    for (const index of [-1, 1]) {
        repo.save(folder, { files, index });
        const before = fs.readFileSync(path.join(folder, "list.yml"), "utf8");
        repo.initialize(folder, () => assert.fail("existing lists do not need a default source"));
        assert.equal(fs.readFileSync(path.join(folder, "list.yml"), "utf8"), before);
    }
});

test("default creation never overwrites a generated filename that already exists", t => {
    let collision;
    const fileSystem = { ...fs, writeFileSync(file, ...args) {
        if (!collision && /^\d+\.yml$/.test(path.basename(file))) {
            collision = file;
            fs.writeFileSync(file, "preserved orphan", { flag: "wx" });
        }
        return fs.writeFileSync(file, ...args);
    } };
    const { folder, repo } = fixture(t, fileSystem);
    repo.initialize(folder, () => "rules: []\n");
    const list = repo.load(folder);
    assert.equal(fs.readFileSync(collision, "utf8"), "preserved orphan");
    assert.notEqual(path.join(folder, list.files[0].time), collision);
    assert.equal(fs.readFileSync(path.join(folder, list.files[0].time), "utf8"), "rules: []\n");
});

test("failed default-list persistence removes only the new profile and leaves the old list for retry", t => {
    const { folder, repo } = fixture(t);
    repo.initialize(folder);
    const before = fs.readFileSync(path.join(folder, "list.yml"), "utf8");
    const failing = createProfilesRepository({ fs: { ...fs, renameSync() { throw Error("read-only list"); } }, path, yaml });
    assert.throws(() => failing.initialize(folder, () => "rules: []\n"), /read-only list/);
    assert.equal(fs.readFileSync(path.join(folder, "list.yml"), "utf8"), before);
    assert.deepEqual(fs.readdirSync(folder), ["list.yml"]);
    repo.initialize(folder, () => "rules: []\n");
    assert.equal(repo.load(folder).index, 0);
});

test("a corrupt existing list is reported without replacing it or creating a default", t => {
    const { folder, repo } = fixture(t);
    fs.writeFileSync(path.join(folder, "list.yml"), "null\n");
    assert.throws(() => repo.initialize(folder, () => assert.fail("must validate the existing list first")), /Invalid profiles list/);
    assert.equal(fs.readFileSync(path.join(folder, "list.yml"), "utf8"), "null\n");
    assert.deepEqual(fs.readdirSync(folder), ["list.yml"]);
});
