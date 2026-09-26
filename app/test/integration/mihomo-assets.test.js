"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const appRoot = path.join(root, "app");
const manifestPath = path.join(appRoot, "clash_core/mihomo-core-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));

assert.equal(manifest.project, "MetaCubeX/mihomo");
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.targets.length, 7);

for (const target of manifest.targets) {
    const binaryPath = path.join(appRoot, target.output);
    assert.equal(fs.existsSync(binaryPath), true, `missing ${target.output}`);
    const binary = fs.readFileSync(binaryPath);
    assert.equal(binary.length > 10 * 1024 * 1024, true, `${target.output} is unexpectedly small`);
    const magic = binary.subarray(0, 4);
    if (target.output.endsWith(".exe")) assert.equal(magic.subarray(0, 2).toString("ascii"), "MZ");
    else if (target.output.includes("/darwin/")) {
        assert.deepEqual([...magic], [0xcf, 0xfa, 0xed, 0xfe]);
    } else assert.deepEqual([...magic], [0x7f, 0x45, 0x4c, 0x46]);
    assert.equal(crypto.createHash("sha256").update(binary).digest("hex"), target.sha256);
    assert.match(target.source, /^https:\/\/github\.com\/MetaCubeX\/mihomo\/releases\/download\//);
    const filesRoot = target.output.slice(0, target.output.indexOf("/static/files/") + "/static/files/".length);
    const notice = fs.readFileSync(path.join(appRoot, filesRoot, "MIHOMO_NOTICE.txt"), "utf8");
    assert.match(notice, new RegExp(`Version: ${manifest.version.replace(/\./g, "\\.")}`));
    assert.match(notice, /GNU General Public License v3\.0/);
}

console.log(`Mihomo ${manifest.version} assets: PASS`);
