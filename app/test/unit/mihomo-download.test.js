"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { zipBuffer } = require("../fixtures/mihomo-dependency");
const { downloadFile, extractBinary } = require("../../../scripts/build/mihomo-download");

async function serverFixture(t, handler) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-mihomo-network-"));
    const server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    return {
        directory,
        options: { env: {}, request: (url, options, callback) => http.get({
            hostname: "127.0.0.1", port: server.address().port, path: url.pathname,
            signal: options.signal, headers: options.headers
        }, callback) }
    };
}

test("downloads follow HTTPS redirects and reject HTTP errors, downgrades and oversized bodies", async t => {
    const f = await serverFixture(t, (req, res) => {
        if (req.url === "/redirect") { res.writeHead(302, { Location: "/binary" }); res.end(); }
        else if (req.url === "/downgrade") { res.writeHead(302, { Location: "http://example.org/binary" }); res.end(); }
        else if (req.url === "/missing") { res.writeHead(404); res.end(); }
        else if (req.url === "/large") { res.writeHead(200, { "Content-Length": "1000" }); res.end(); }
        else res.end("binary");
    });
    const destination = path.join(f.directory, "download");
    await downloadFile("https://fixture.test/redirect", destination, f.options);
    assert.equal(fs.readFileSync(destination, "utf8"), "binary");
    await assert.rejects(downloadFile("https://fixture.test/missing", `${destination}-404`, f.options), /HTTP 404/);
    await assert.rejects(downloadFile("https://fixture.test/downgrade", `${destination}-http`, f.options), /HTTPS/);
    await assert.rejects(downloadFile("https://fixture.test/large", `${destination}-large`, { ...f.options, maximum: 10 }), /size limit/);
    await assert.rejects(downloadFile("https://fixture.test/binary", `${destination}-stream`, { ...f.options, maximum: 3 }), /size limit/);
    await assert.rejects(downloadFile("https://fixture.test/redirect", `${destination}-loop`, {
        ...f.options, request: (url, options, cb) => f.options.request(new URL("https://fixture.test/redirect"), options, cb)
    }), /redirects/);
});

test("stalled downloads have a bounded total timeout", async t => {
    const f = await serverFixture(t, (req, res) => { res.writeHead(200); res.write("partial"); });
    await assert.rejects(downloadFile("https://fixture.test/stall", path.join(f.directory, "stall"), {
        ...f.options, timeout: 50
    }), /abort/i);
});

test("ZIP extraction rejects ambiguous executables and traversal entries", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-mihomo-zip-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const archive = path.join(directory, "archive.zip");
    const output = path.join(directory, "binary");
    const spec = { asset: "fixture.zip" };
    for (const entries of [
        [["mihomo-one.exe", Buffer.from("first")], ["mihomo-two.exe", Buffer.from("second")]],
        [["../mihomo.exe", Buffer.from("escape")]],
        [["readme.txt", Buffer.from("no executable")]]
    ]) {
        fs.writeFileSync(archive, zipBuffer(entries));
        await assert.rejects(extractBinary(archive, output, spec));
        assert.equal(fs.existsSync(output), false);
    }
});
