"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { fixture, binaryFor } = require("../fixtures/mihomo-dependency");
const { targets, targetSpec, readManifest, sha256, matches, verifyServiceManifest,
    prepareMihomo, updateMihomo } = require("../../../scripts/build/mihomo-dependency");

function snapshot(f) {
    const result = new Map([[f.manifestPath, fs.readFileSync(f.manifestPath)]]);
    for (const name of Object.keys(targets)) {
        const spec = targetSpec(name, f.manifest.version);
        for (const relative of [spec.output, spec.notice, spec.serviceManifest]) {
            const file = path.join(f.root, "app", relative);
            result.set(file, fs.existsSync(file) ? fs.readFileSync(file) : null);
        }
    }
    return result;
}

function unchanged(files) {
    for (const [file, previous] of files) {
        if (previous) assert.deepEqual(fs.readFileSync(file), previous, file);
        else assert.equal(fs.existsSync(file), false, file);
    }
}

test("a clean checkout prepares all six locked platforms using real ZIP and gzip extraction", async t => {
    const f = fixture(t);
    const before = snapshot(f);
    await prepareMihomo(f);
    assert.equal(f.requests.length, 6);
    for (const entry of f.manifest.targets) {
        assert.equal(sha256(path.join(f.root, "app", entry.output)), entry.sha256);
        assert.equal(sha256(path.join(f.cacheRoot, entry.sha256, path.posix.basename(entry.output))), entry.sha256);
    }
    for (const [file, value] of before) if (value) assert.deepEqual(fs.readFileSync(file), value);
    // Neither the restored files nor the cache need the network on later builds.
    for (const entry of f.manifest.targets) fs.unlinkSync(path.join(f.root, "app", entry.output));
    await prepareMihomo({ ...f, offline: true, download() { throw Error("unexpected network"); } });
    assert.equal(f.requests.length, 6);
    for (const entry of f.manifest.targets) assert.equal(sha256(path.join(f.root, "app", entry.output)), entry.sha256);
});

test("existing validated assets seed the cache without downloading; target selection is explicit", async t => {
    const f = fixture(t, { materialized: true });
    const before = snapshot(f);
    await prepareMihomo({ ...f, targetNames: ["win-arm64"], offline: true });
    assert.equal(f.requests.length, 0);
    unchanged(before);
    const entry = f.manifest.targets[1];
    assert.equal(sha256(path.join(f.cacheRoot, entry.sha256, path.posix.basename(entry.output))), entry.sha256);
    assert.equal(fs.readdirSync(f.cacheRoot).length, 1);
    await assert.rejects(prepareMihomo({ ...f, targetNames: ["win-ia32"] }), /Unsupported/);
    await assert.rejects(prepareMihomo({ ...f, targetNames: ["win-x64", "win-x64"] }), /unique/);
});

test("offline missing or corrupt assets fail without changing the lock or service allow-list", async t => {
    const f = fixture(t);
    const before = snapshot(f);
    await assert.rejects(prepareMihomo({ ...f, offline: true }), /verified local cache/);
    unchanged(before);
    await prepareMihomo(f);
    const entry = f.manifest.targets[0];
    fs.writeFileSync(path.join(f.root, "app", entry.output), "corrupt");
    fs.writeFileSync(path.join(f.cacheRoot, entry.sha256, path.posix.basename(entry.output)), "corrupt");
    await assert.rejects(prepareMihomo({ ...f, offline: true }), /verified local cache/);
    await prepareMihomo({ ...f, targetNames: ["win-x64"] });
    assert.equal(f.requests.length, 7);
    assert.equal(sha256(path.join(f.root, "app", entry.output)), entry.sha256);
});

test("hash mismatch never installs an asset or teaches the allow-list to trust it", async t => {
    const f = fixture(t);
    const before = snapshot(f);
    await assert.rejects(prepareMihomo({ ...f, extract: async (archive, output, spec) => {
        fs.writeFileSync(output, binaryFor(spec, "wrong-version"));
    } }), /SHA-256 mismatch/);
    unchanged(before);
    assert.equal(fs.existsSync(f.cacheRoot), false);
});

test("stale service hashes stop preparation before downloading", async t => {
    const f = fixture(t);
    const spec = targetSpec("mac-arm64", f.manifest.version);
    fs.writeFileSync(path.join(f.root, "app", spec.legacy), "unexpected legacy core");
    const before = snapshot(f);
    await assert.rejects(prepareMihomo(f), /Service allow-list/);
    await assert.rejects(updateMihomo("2.0.0", f), /Service allow-list/);
    assert.equal(f.requests.length, 0);
    unchanged(before);
});

test("manifest validation rejects path traversal, untrusted sources, duplicates and floating versions", t => {
    const f = fixture(t);
    for (const mutate of [
        m => { m.version = "latest"; },
        m => { m.targets[0].output = "../outside.exe"; },
        m => { m.targets[0].source = "https://example.org/mihomo.zip"; },
        m => { m.targets[0].sha256 = "invalid"; },
        m => { m.targets[1] = m.targets[0]; }
    ]) {
        const candidate = structuredClone(f.manifest);
        mutate(candidate);
        fs.writeFileSync(f.manifestPath, JSON.stringify(candidate));
        assert.throws(() => readManifest(f.root), /Mihomo/);
    }
});

test("dependency hashes and type checks use the same descriptor and always close it", t => {
    const f = fixture(t, { materialized: true });
    const file = path.join(f.root, "app", f.manifest.targets[0].output);
    const digest = f.manifest.targets[0].sha256;
    const stat = fs.fstatSync, read = fs.readFileSync, close = fs.closeSync;
    let checked, closed = 0, failRead = false;
    t.mock.method(fs, "fstatSync", descriptor => { checked = descriptor; return stat(descriptor); });
    t.mock.method(fs, "readFileSync", (source, ...args) => {
        assert.equal(source, checked, "hashing must not reopen the checked pathname");
        if (failRead) throw Object.assign(Error("read failed"), { code: "EIO" });
        return read(source, ...args);
    });
    t.mock.method(fs, "closeSync", descriptor => { closed++; return close(descriptor); });
    assert.equal(matches(file, digest), true);
    assert.equal(closed, 1);
    assert.equal(matches(file, "0".repeat(64)), false);
    assert.equal(closed, 2);
    assert.equal(matches(path.join(f.root, "missing"), digest), false);
    assert.equal(matches(f.root, digest), false);
    failRead = true;
    const before = closed;
    assert.throws(() => matches(file, digest), /read failed/);
    assert.equal(closed, before + 1);
    t.mock.restoreAll();
});

test("download URLs are canonical release assets and invalid manifest sources never reach the network", async t => {
    const f = fixture(t);
    await prepareMihomo({ ...f, targetNames: ["linux-x64"] });
    assert.deepEqual(f.requests, [targetSpec("linux-x64", f.manifest.version).source]);
    const candidate = structuredClone(f.manifest);
    candidate.targets[0].source = "https://example.org/private-file-data";
    fs.writeFileSync(f.manifestPath, JSON.stringify(candidate));
    await assert.rejects(prepareMihomo({ ...f, targetNames: ["win-x64"] }), /dependency lock/);
    assert.equal(f.requests.length, 1);
    for (const version of ["01.2.3", "1.02.3", "1.2.03", "1.2.9007199254740992", "1.2.3?private=data"]) {
        assert.throws(() => targetSpec("linux-x64", version), /Mihomo version/);
    }
});

test("an upgrade resolves every platform before committing binaries, notices and allow-lists", async t => {
    const f = fixture(t, { materialized: true });
    const manifest = await updateMihomo("2.0.0", f);
    assert.equal(manifest.version, "2.0.0");
    assert.equal(f.requests.length, 6);
    assert.deepEqual(readManifest(f.root), manifest);
    for (const name of Object.keys(targets)) {
        const spec = targetSpec(name, manifest.version);
        const entry = manifest.targets.find(item => item.output === spec.output);
        assert.equal(sha256(path.join(f.root, "app", spec.output)), entry.sha256);
        verifyServiceManifest(f.root, spec, entry.sha256);
        assert.match(fs.readFileSync(path.join(f.root, "app", spec.notice), "utf8"), /Version: 2\.0\.0/);
    }
    await prepareMihomo({ ...f, offline: true });
});

test("a late download failure or wrong CPU preserves the complete previous release", async t => {
    const f = fixture(t, { materialized: true });
    const before = snapshot(f);
    let calls = 0;
    await assert.rejects(updateMihomo("2.0.0", { ...f, download: async (...args) => {
        if (++calls === 6) throw Error("download interrupted");
        await f.download(...args);
    } }), /interrupted/);
    unchanged(before);
    assert.equal(fs.existsSync(f.cacheRoot), false);
    await assert.rejects(updateMihomo("2.0.0", { ...f, extract: async (archive, output) => {
        fs.writeFileSync(output, binaryFor(targetSpec("win-arm64", "2.0.0"), "2.0.0"));
    } }), /architecture/);
    unchanged(before);
});

test("re-resolving a locked version rejects upstream changes", async t => {
    const f = fixture(t, { materialized: true });
    const before = snapshot(f);
    await assert.rejects(updateMihomo(f.manifest.version, { ...f, extract: async (archive, output, spec) => {
        fs.writeFileSync(output, binaryFor(spec, "changed upstream"));
    } }), /already locked version/);
    unchanged(before);
});

test("a replacement failure rolls back already installed files and metadata", async t => {
    const f = fixture(t, { materialized: true });
    const before = snapshot(f);
    const originalRename = fs.renameSync;
    let replaced = 0;
    t.mock.method(fs, "renameSync", (...args) => {
        if (++replaced === 7) throw Error("fixture replacement failure");
        return originalRename(...args);
    });
    await assert.rejects(updateMihomo("2.0.0", f), /replacement failure/);
    unchanged(before);
});

test("concurrent preparation cannot race an update transaction, and failure releases the lock", async t => {
    const f = fixture(t);
    let release;
    let entered;
    const started = new Promise(resolve => { entered = resolve; });
    const pending = prepareMihomo({ ...f, download: async () => {
        entered();
        await new Promise(resolve => { release = resolve; });
        throw Error("cancelled fixture");
    } });
    await started;
    await assert.rejects(updateMihomo("2.0.0", f), /already running/);
    release();
    await assert.rejects(pending, /cancelled/);
    await prepareMihomo(f);
});
