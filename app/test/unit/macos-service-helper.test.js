"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const source = fs.readFileSync(path.join(root, "scripts/native/linux-service-helper/main.go"), "utf8");
const updater = fs.readFileSync(path.join(root, "app/update_mihomo_cores.ps1"), "utf8");
const targets = [
    {
        directory: "app/clash_core/darwin-x64/static/files/darwin/x64",
        cpuType: 0x01000007,
        cores: ["clash-darwin", "mihomo-darwin-amd64"]
    },
    {
        directory: "app/clash_core/darwin-arm64/static/files/darwin/arm64",
        cpuType: 0x0100000c,
        cores: ["clash-darwin", "mihomo-darwin-arm64"]
    }
];

const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

test("macOS Service Mode uses the loopback-only hash allow-list helper", () => {
    assert.match(source, /defaultListenAddress = "127\.0\.0\.1:53000"/);
    assert.match(source, /subtle\.ConstantTimeCompare/);
    assert.doesNotMatch(source, /HandleFunc\("\/command"/);
    assert.match(source, /HandleFunc\("\/system-proxy"/);
    assert.match(source, /validSystemProxyArgs/);
    assert.match(updater, /darwin-x64\/static\/files\/darwin\/x64/);
    assert.match(updater, /darwin-arm64\/static\/files\/darwin\/arm64/);
    assert.match(updater, /service\/core-hashes\.json/);
});

for (const target of targets) {
    test(`macOS Service Mode assets match CPU type ${target.cpuType}`, () => {
        const directory = path.join(root, target.directory);
        const serviceDirectory = path.join(directory, "service");
        const helper = fs.readFileSync(path.join(serviceDirectory, "clash-core-service"));
        assert.deepEqual([...helper.subarray(0, 4)], [0xcf, 0xfa, 0xed, 0xfe]);
        assert.equal(helper.readUInt32LE(4), target.cpuType);
        assert.notEqual(helper.indexOf(Buffer.from("core-hashes.json")), -1);
        assert.notEqual(helper.indexOf(Buffer.from("CFW_SERVICE_TEST_LISTEN_ADDRESS")), -1);
        assert.notEqual(helper.indexOf(Buffer.from("/system-proxy")), -1);
        assert.equal(helper.indexOf(Buffer.from("middlewares.SignValidate")), -1);

        const manifest = JSON.parse(fs.readFileSync(path.join(serviceDirectory, "core-hashes.json"), "utf8"));
        assert.deepEqual(manifest.cores.map(core => core.name), target.cores);
        for (const core of manifest.cores) {
            assert.equal(core.sha256, sha256(path.join(directory, core.name)), core.name);
        }
        assert.deepEqual(manifest.helpers.map(helper => helper.name), ["sysproxy"]);
        assert.equal(manifest.helpers[0].sha256, sha256(path.join(directory, "sysproxy")));
    });
}
