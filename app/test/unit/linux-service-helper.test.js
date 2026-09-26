"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const source = fs.readFileSync(path.join(
    root, "scripts/native/linux-service-helper/main.go"
), "utf8");

const targets = [
    {
        directory: "app/clash_core/linux-x64/static/files/linux/x64",
        machine: 62,
        cores: ["clash-linux", "mihomo-linux-amd64"]
    },
    {
        directory: "app/clash_core/linux-arm64/static/files/linux/arm64",
        machine: 183,
        cores: ["clash-linux", "mihomo-linux-arm64"]
    }
];

const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

test("Linux Service Mode helper is loopback-only and starts only hash-allow-listed cores", () => {
    assert.match(source, /defaultListenAddress = "127\.0\.0\.1:53000"/);
    assert.match(source, /subtle\.ConstantTimeCompare/);
    assert.match(source, /allowed\[filepath\.Base\(path\)\]/);
    assert.match(source, /exec\.Command\(corePath, "-d", workingDirectory\)/);
    assert.match(source, /http\.MaxBytesReader/);
    assert.match(source, /operation\s+sync\.Mutex/);
    assert.doesNotMatch(source, /HandleFunc\("\/command"/);
});

for (const target of targets) {
    test(`Linux ${target.machine} Service Mode assets match both allow-listed cores`, () => {
        const directory = path.join(root, target.directory);
        const serviceDirectory = path.join(directory, "service");
        const helper = fs.readFileSync(path.join(serviceDirectory, "clash-core-service"));
        assert.deepEqual([...helper.subarray(0, 4)], [0x7f, 0x45, 0x4c, 0x46]);
        assert.equal(helper.readUInt16LE(18), target.machine);
        assert.notEqual(helper.indexOf(Buffer.from("core-hashes.json")), -1);
        assert.notEqual(helper.indexOf(Buffer.from("CFW_SERVICE_TEST_LISTEN_ADDRESS")), -1);
        assert.notEqual(helper.indexOf(Buffer.from("/system-proxy")), -1);
        assert.equal(helper.indexOf(Buffer.from("middlewares.SignValidate")), -1);

        const manifest = JSON.parse(fs.readFileSync(path.join(serviceDirectory, "core-hashes.json"), "utf8"));
        assert.deepEqual(manifest.cores.map(core => core.name), target.cores);
        for (const core of manifest.cores) {
            assert.equal(core.sha256, sha256(path.join(directory, core.name)), core.name);
        }
    });
}
