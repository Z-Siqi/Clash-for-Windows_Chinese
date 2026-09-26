"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../../..");
const targets = {
    "win32:x64": "app/clash_core/win_x64/static/files/win/x64/mihomo-windows-amd64.exe",
    "win32:ia32": "app/clash_core/win32-ia32/static/files/win/ia32/mihomo-windows-386.exe",
    "win32:arm64": "app/clash_core/win32-arm64/static/files/win/arm64/mihomo-windows-arm64.exe",
    "linux:x64": "app/clash_core/linux-x64/static/files/linux/x64/mihomo-linux-amd64",
    "linux:arm64": "app/clash_core/linux-arm64/static/files/linux/arm64/mihomo-linux-arm64",
    "darwin:x64": "app/clash_core/darwin-x64/static/files/darwin/x64/mihomo-darwin-amd64",
    "darwin:arm64": "app/clash_core/darwin-arm64/static/files/darwin/arm64/mihomo-darwin-arm64"
};
const relativeBinary = targets[`${process.platform}:${process.arch}`];
if (!relativeBinary) {
    console.log(`Mihomo AnyTLS config smoke: SKIP (${process.platform}/${process.arch})`);
    process.exit(0);
}

const binary = path.join(root, relativeBinary);
if (process.platform !== "win32") fs.chmodSync(binary, 0o755);
const config = path.join(root, "app/test/fixtures/mihomo-anytls.yaml");
const home = path.join(os.tmpdir(), "cfw-mihomo-anytls-smoke");
fs.mkdirSync(home, { recursive: true });
const result = spawnSync(binary, ["-t", "-d", home, "-f", config], {
    encoding: "utf8",
    windowsHide: true
});
assert.equal(result.status, 0, result.stderr || result.stdout || result.error);
assert.match(`${result.stdout}\n${result.stderr}`, /test is successful|configuration/i);
console.log("Mihomo AnyTLS config smoke: PASS");
