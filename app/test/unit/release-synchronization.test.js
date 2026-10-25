"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const release = require("../../main/dist/electron/core/release/release-info");
const { synchronizeRelease } = require("../../../scripts/build/sync-release");

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-release-sync-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, "app/main"), { recursive: true });
    fs.mkdirSync(path.join(root, "CFW/BuildRelease/InnoSetup"), { recursive: true });
    fs.writeFileSync(path.join(root, "app/main/package.json"), '{"version":"0.0.0"}');
    fs.writeFileSync(path.join(root, "app/main/package-lock.json"), '{"version":"0.0.0","packages":{"":{"version":"0.0.0"}}}');
    fs.writeFileSync(path.join(root, "update"), '{"body":"release notes"}');
    return { root, installer: path.join(root, "CFW/BuildRelease/InnoSetup/release.generated.iss") };
}

test("release synchronization creates missing output atomically without checking target existence", t => {
    const { root, installer } = fixture(t);
    const renames = [];
    const fileSystem = { ...fs,
        existsSync(file) {
            assert.match(path.basename(file), /^\..*\.tmp$/, "only the owned temporary file may be checked");
            return fs.existsSync(file);
        },
        writeFileSync(file, content, options) {
            assert.match(path.basename(file), /^\..*\.tmp$/);
            assert.equal(options.flag, "wx");
            return fs.writeFileSync(file, content, options);
        },
        renameSync(source, target) { renames.push(target); fs.renameSync(source, target); }
    };
    assert.equal(synchronizeRelease(root, release, false, fileSystem).length, 4);
    assert.equal(renames.length, 4);
    assert.ok(renames.includes(installer));
    assert.deepEqual(synchronizeRelease(root, release, true, fileSystem), []);
    assert.equal(renames.length, 4);
});

test("a failed release replacement preserves existing content and removes its temporary file", t => {
    const { root } = fixture(t);
    const manifest = path.join(root, "app/main/package.json");
    const previous = fs.readFileSync(manifest, "utf8");
    const fileSystem = { ...fs, renameSync() { throw Object.assign(Error("replacement refused"), { code: "EACCES" }); } };
    assert.throws(() => synchronizeRelease(root, release, false, fileSystem), /replacement refused/);
    assert.equal(fs.readFileSync(manifest, "utf8"), previous);
    assert.deepEqual(fs.readdirSync(path.dirname(manifest)).sort(), ["package-lock.json", "package.json"]);
});

test("check mode neither creates missing output nor treats read failures as missing files", t => {
    const { root, installer } = fixture(t);
    assert.throws(() => synchronizeRelease(root, release, true), /out of date/);
    assert.equal(fs.existsSync(installer), false);
    const error = Object.assign(Error("metadata unreadable"), { code: "EACCES" });
    const fileSystem = { ...fs, readFileSync(file, ...args) {
        if (file === installer) throw error;
        return fs.readFileSync(file, ...args);
    } };
    assert.throws(() => synchronizeRelease(root, release, true, fileSystem), value => value === error);
    assert.equal(fs.existsSync(installer), false);
});
