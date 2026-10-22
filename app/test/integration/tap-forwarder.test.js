"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../..");
const manifest = require("../../clash_core/tap-forwarder-manifest.json");

test("packaged TAP forwarders match their pinned native sources and binary digests", () => {
    for (const { file, sha256 } of manifest.targets) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex"), sha256, file);
    for (const [file, sha256] of Object.entries(manifest.sources)) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n")).digest("hex"), sha256, file);
    const script = target => fs.readFileSync(path.join(root, "app/clash_core", target, "static/files/win/common/tun2socks/multicast_route.ps1"), "utf8");
    assert.equal(script("win_x64"), script("win32-arm64"));
});

test("both packaged Windows helpers filter all IPv4 multicast and preserve legacy opt-in without opening adapters", {
    skip: process.platform !== "win32" ? "requires Windows executables; portable Go policy tests run during native build" : false
}, () => {
    for (const target of manifest.targets) {
        for (const [destination, filtered] of [["224.0.0.0", true], ["224.0.0.251", true], ["224.0.0.252", true], ["239.255.255.250", true],
            ["239.255.255.255", true], ["223.255.255.255", false], ["240.0.0.0", false], ["10.0.0.1", false], ["255.255.255.255", false]]) {
            const packet = Buffer.alloc(20); packet[0] = 0x45; packet.set(destination.split(".").map(Number), 16);
            for (const allow of [false, true]) {
                const result = spawnSync(path.join(root, target.file), [`-allowMulticast=${allow}`, "-checkPacket", packet.toString("hex")], { encoding: "utf8", windowsHide: true, timeout: 5000 });
                assert.equal(result.status, 0, result.stderr);
                assert.equal(result.stdout.trim(), filtered && !allow ? "DROP" : "FORWARD", `${target.arch} ${destination} compatibility=${allow}`);
            }
        }
    }
});
