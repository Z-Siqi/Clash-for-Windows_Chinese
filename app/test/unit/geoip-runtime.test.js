"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const zlib = require("node:zlib");
const { Readable } = require("node:stream");
const got = require("../../main/node_modules/got");
const tarStream = require("../../main/node_modules/tar-stream");
const { createGeoipRuntime } = require("../../main/dist/electron/features/clash-core/geoip-runtime");

function temporaryHome(t) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-geoip-test-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    return home;
}
const database = Buffer.concat([Buffer.alloc(256), Buffer.from([171, 205, 239]), Buffer.from("MaxMind.com")]);

test("GeoIP update downloads from loopback and atomically replaces only the fixed database", async t => {
    const home = temporaryHome(t), progress = [];
    fs.writeFileSync(path.join(home, "Country.mmdb"), "old");
    const server = http.createServer((_request, response) => response.end(database));
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const runtime = createGeoipRuntime({ fs, path, got, zlib, tarStream });
    const modified = await runtime.update({ home, url: `http://127.0.0.1:${server.address().port}/fixture`, onProgress: value => progress.push(value) });
    assert.ok(modified > 0);
    assert.deepEqual(fs.readFileSync(path.join(home, "Country.mmdb")), database);
    assert.equal(progress.at(-1), 1);
    assert.deepEqual(fs.readdirSync(home), ["Country.mmdb"]);
});

test("GeoIP rejects invalid payloads and failed atomic replacement preserves the previous database", async t => {
    const home = temporaryHome(t), target = path.join(home, "Country.mmdb");
    fs.writeFileSync(target, "previous");
    const runtime = body => createGeoipRuntime({ fs, path, got: { stream: () => Readable.from([body]) }, zlib, tarStream });
    await assert.rejects(runtime(Buffer.from("bad")).update({ home, url: "https://fixture.invalid" }), /signature/);
    await assert.rejects(runtime(database).update({ home, url: "file:///untrusted" }), /Unsupported/);
    const failingFs = Object.assign({}, fs, { renameSync() { throw new Error("fixture rename failure"); } });
    await assert.rejects(createGeoipRuntime({ fs: failingFs, path, got: { stream: () => Readable.from([database]) }, zlib, tarStream }).update({ home, url: "https://fixture.invalid" }));
    assert.equal(fs.readFileSync(target, "utf8"), "previous");
    assert.deepEqual(fs.readdirSync(home), ["Country.mmdb"]);
});

test("GeoIP rejects oversized downloads and archives with duplicate databases", async t => {
    const home = temporaryHome(t);
    fs.writeFileSync(path.join(home, "Country.mmdb"), "preserved");
    const runtime = body => createGeoipRuntime({ fs, path, got: { stream: () => Readable.from([body]) }, zlib, tarStream });
    await assert.rejects(runtime(Buffer.alloc(33554433)).update({ home, url: "https://fixture.invalid" }), /too large/);
    const archive = tarStream.pack(), chunks = [];
    archive.on("data", chunk => chunks.push(chunk));
    const ended = new Promise(resolve => archive.on("end", resolve));
    archive.entry({ name: "one/GeoLite2-Country.mmdb" }, database);
    archive.entry({ name: "two/GeoLite2-Country.mmdb" }, database);
    archive.finalize();
    await ended;
    await assert.rejects(runtime(zlib.gzipSync(Buffer.concat(chunks))).update({ home, token: "fixture-token" }), /Invalid/);
    assert.equal(fs.readFileSync(path.join(home, "Country.mmdb"), "utf8"), "preserved");
});

test("GeoIP archive entry names cannot select filesystem destinations", async t => {
    const home = temporaryHome(t), archive = tarStream.pack(), chunks = [];
    archive.on("data", chunk => chunks.push(chunk));
    const ended = new Promise(resolve => archive.on("end", resolve));
    archive.entry({ name: "../../outside/GeoLite2-Country.mmdb" }, database);
    archive.finalize();
    await ended;
    const runtime = createGeoipRuntime({ fs, path, got: { stream: () => Readable.from([zlib.gzipSync(Buffer.concat(chunks))]) }, zlib, tarStream });
    await runtime.update({ home, token: "fixture-token" });
    assert.deepEqual(fs.readdirSync(home), ["Country.mmdb"]);
    assert.deepEqual(fs.readFileSync(path.join(home, "Country.mmdb")), database);
});
