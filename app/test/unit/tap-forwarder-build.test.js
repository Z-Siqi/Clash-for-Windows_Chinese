"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { prepareSourceArchive } = require("../../../scripts/build/build-tap-forwarder");

test("TAP build downloads only to an exclusive bounded staging file and verifies its pin before extraction", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-tap-source-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const bytes = Buffer.from("pinned archive fixture");
    const metadata = { archive: "https://source.invalid/archive.tar.gz", sha256: createHash("sha256").update(bytes).digest("hex") };
    let calls = 0;
    const download = async (url, file, options) => {
        calls++; assert.equal(url, metadata.archive); assert.equal(options.maximum, 8 * 1024 * 1024);
        assert.equal(path.dirname(file), directory);
        fs.writeFileSync(file, bytes, { flag: "wx" });
    };
    const file = await prepareSourceArchive(directory, metadata, download);
    assert.deepEqual(fs.readFileSync(file), bytes);
    await assert.rejects(prepareSourceArchive(directory, metadata, download), { code: "EEXIST" });
    assert.equal(calls, 2);
    assert.deepEqual(fs.readFileSync(file), bytes, "a second build cannot overwrite an existing archive");
    const altered = fs.mkdtempSync(path.join(directory, "altered-"));
    await assert.rejects(prepareSourceArchive(altered, metadata, async (_url, target) => {
        fs.writeFileSync(target, "untrusted different archive", { flag: "wx" });
    }), /integrity check failed/);
});
