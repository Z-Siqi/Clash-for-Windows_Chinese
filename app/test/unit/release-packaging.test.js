"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { gunzipSync } = require("node:zlib");
const { planTargets, resolveContained } = require("../../../CFW/BuildRelease/build-release");
const { createDeb } = require("../../../CFW/BuildRelease/linux-packages");

function tarEntries(buffer) {
    const entries = [];
    for (let offset = 0; offset < buffer.length && buffer[offset];) {
        const header = buffer.subarray(offset, offset + 512);
        const text = (start, length) => header.subarray(start, start + length).toString().replace(/\0.*$/s, "");
        const size = parseInt(text(124, 12), 8);
        const prefix = text(345, 155);
        entries.push({ name: (prefix ? `${prefix}/` : "") + text(0, 100), mode: parseInt(text(100, 8), 8), uid: parseInt(text(108, 8), 8), gid: parseInt(text(116, 8), 8), data: buffer.subarray(offset + 512, offset + 512 + size).toString() });
        offset += 512 + Math.ceil(size / 512) * 512;
    }
    return entries;
}

test("release target planning reports host limits and rejects an impossible all-platform run before building", () => {
    assert.deepEqual(planTargets("win32").targets, ["win-x64", "win-arm64", "linux-x64", "linux-arm64"]);
    assert.deepEqual(planTargets("darwin").targets, ["linux-x64", "linux-arm64", "mac-x64", "mac-arm64"]);
    assert.deepEqual(planTargets("linux").targets, ["linux-x64", "linux-arm64"]);
    assert.throws(() => planTargets("win32", ["mac-x64"]), /another host/);
    assert.throws(() => planTargets("win32", ["win-x64", "win-x64"]), /unique/);
    assert.throws(() => resolveContained(os.tmpdir(), "../outside"), /outside/);
});

for (const target of ["linux-x64", "linux-arm64"]) {
    test(`Debian ${target} package retains architecture, root ownership, sandbox and executable modes`, async t => {
        const folder = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-deb-test-"));
        t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
        const packagePath = path.join(folder, "application");
        fs.mkdirSync(path.join(packagePath, "resources/static/imgs"), { recursive: true });
        fs.writeFileSync(path.join(packagePath, "resources/static/imgs/icon_512.png"), "fixture image");
        fs.writeFileSync(path.join(packagePath, "cfw"), Buffer.from([0x7f, 69, 76, 70]));
        fs.writeFileSync(path.join(packagePath, "chrome-sandbox"), Buffer.from([0x7f, 69, 76, 70]));
        const output = path.join(folder, "package.deb");
        await createDeb({ packagePath, target, version: "0.20.39.4", output, staging: path.join(folder, "staging"), applicationId: "com.lbyczf.clashwin" });
        const archive = fs.readFileSync(output);
        assert.equal(archive.subarray(0, 8).toString(), "!<arch>\n");
        const members = new Map();
        for (let offset = 8; offset < archive.length;) {
            const name = archive.subarray(offset, offset + 16).toString().trim().replace(/\/$/, "");
            const size = Number(archive.subarray(offset + 48, offset + 58).toString().trim());
            assert.equal(archive.subarray(offset + 58, offset + 60).toString(), "`\n");
            members.set(name, archive.subarray(offset + 60, offset + 60 + size));
            offset += 60 + size + size % 2;
        }
        assert.equal(members.get("debian-binary").toString(), "2.0\n");
        const control = tarEntries(gunzipSync(members.get("control.tar.gz")));
        assert.match(control.find(entry => entry.name === "control").data, new RegExp(`Architecture: ${target === "linux-x64" ? "amd64" : "arm64"}`));
        assert.equal(control.find(entry => entry.name === "postinst").mode, 0o755);
        const data = tarEntries(gunzipSync(members.get("data.tar.gz")));
        const sandbox = data.find(entry => entry.name === "opt/clash-for-windows/chrome-sandbox");
        assert.equal(sandbox.mode, 0o4755);
        assert.equal(sandbox.uid, 0); assert.equal(sandbox.gid, 0);
        assert.equal(data.find(entry => entry.name === "opt/clash-for-windows/cfw").mode, 0o755);
        assert.equal(data.find(entry => entry.name === "usr/bin/cfw").mode, 0o755);
        assert.equal(data.find(entry => entry.name.endsWith(".desktop")).mode, 0o644);
    });
}
