"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { readManifest } = require("../../../scripts/build/mihomo-dependency");

const root = path.resolve(__dirname, "../../..");

test("Mihomo binaries are ignored external dependencies and cannot re-enter the Git index", t => {
    const probe = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8", windowsHide: true });
    if (probe.status !== 0 || path.resolve(probe.stdout.trim()) !== root) {
        t.skip("Git checkout metadata is unavailable (for example, a source archive)");
        return;
    }
    const outputs = readManifest(root).targets.map(entry => `app/${entry.output}`);
    const tracked = spawnSync("git", ["ls-files", "--", ...outputs], { cwd: root, encoding: "utf8", windowsHide: true });
    assert.equal(tracked.status, 0, tracked.stderr);
    assert.equal(tracked.stdout.trim(), "", "Do not commit Mihomo executables; use mihomo:update and its text lockfile");
    const ignored = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], {
        cwd: root, input: `${outputs.join("\n")}\n`, encoding: "utf8", windowsHide: true
    });
    assert.equal(ignored.status, 0, ignored.stderr);
    assert.deepEqual(ignored.stdout.trim().split(/\r?\n/).sort(), outputs.sort());
    const packageManifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.equal(packageManifest.scripts["mihomo:prepare"], "node scripts/build/mihomo.js prepare");
    assert.equal(packageManifest.scripts["mihomo:update"], "node scripts/build/mihomo.js update");
});
