"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { gzipSync, deflateRawSync } = require("node:zlib");
const { targets, targetSpec, sha256, serviceManifest } = require("../../../scripts/build/mihomo-dependency");

function binaryFor(spec, version) {
    const binary = Buffer.alloc(256);
    if (spec.platform === "win32") {
        binary.write("MZ");
        binary.writeUInt32LE(64, 60);
        binary.writeUInt32LE(0x4550, 64);
        binary.writeUInt16LE(spec.arch === "x64" ? 0x8664 : 0xaa64, 68);
    } else if (spec.platform === "linux") {
        binary.write("\x7fELF");
        binary[4] = 2;
        binary[5] = 1;
        binary.writeUInt16LE(spec.arch === "x64" ? 62 : 183, 18);
    } else {
        binary.writeUInt32LE(0xfeedfacf);
        binary.writeUInt32LE(spec.arch === "x64" ? 0x01000007 : 0x0100000c, 4);
    }
    binary.write(`${spec.name}:${version}`, 96);
    return binary;
}

function zipBuffer(entries) {
    const local = [], central = [];
    let offset = 0;
    for (const [name, data] of entries) {
        const filename = Buffer.from(name);
        const compressed = deflateRawSync(data);
        let crc = 0xffffffff;
        for (const byte of data) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(8, 8);
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(compressed.length, 18);
        header.writeUInt32LE(data.length, 22);
        header.writeUInt16LE(filename.length, 26);
        local.push(header, filename, compressed);
        const record = Buffer.alloc(46);
        record.writeUInt32LE(0x02014b50);
        record.writeUInt16LE(20, 4);
        record.writeUInt16LE(20, 6);
        record.writeUInt16LE(8, 10);
        record.writeUInt32LE(crc, 16);
        record.writeUInt32LE(compressed.length, 20);
        record.writeUInt32LE(data.length, 24);
        record.writeUInt16LE(filename.length, 28);
        record.writeUInt32LE(offset, 42);
        central.push(record, filename);
        offset += header.length + filename.length + compressed.length;
    }
    const directory = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, directory, end]);
}

function fixture(t, { version = "1.0.0", materialized = false } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-mihomo-test-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const manifestPath = path.join(root, "app/clash_core/mihomo-core-manifest.json");
    const cacheRoot = path.join(root, "cache");
    const manifest = { project: "MetaCubeX/mihomo", version,
        release: `https://github.com/MetaCubeX/mihomo/releases/tag/v${version}`, targets: [] };
    const binaries = new Map();
    function write(file, value) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, value);
    }
    for (const name of Object.keys(targets)) {
        const spec = targetSpec(name, version);
        const binary = binaryFor(spec, version);
        const temporary = path.join(root, name);
        write(temporary, binary);
        const digest = sha256(temporary);
        fs.unlinkSync(temporary);
        binaries.set(name, binary);
        write(path.join(root, "app", spec.legacy), `legacy:${name}`);
        if (spec.platform === "win32") write(path.join(root, "app", path.posix.dirname(spec.output), "wintun.dll"), `wintun:${name}`);
        if (spec.platform === "darwin") write(path.join(root, "app", path.posix.dirname(spec.output), "sysproxy"), `sysproxy:${name}`);
        write(path.join(root, "app", spec.serviceManifest), JSON.stringify(serviceManifest(root, spec, digest)));
        write(path.join(root, "app", spec.notice), `original notice:${version}`);
        if (materialized) write(path.join(root, "app", spec.output), binary);
        manifest.targets.push({ asset: spec.asset, output: spec.output, source: spec.source, sha256: digest });
    }
    write(manifestPath, JSON.stringify(manifest));
    let requests = [];
    async function download(url, destination) {
        requests.push(url);
        const match = url.match(/\/v(\d+\.\d+\.\d+)\/(mihomo-.+)$/);
        const spec = Object.keys(targets).map(name => targetSpec(name, match[1])).find(item => item.asset === match[2]);
        const binary = binaryFor(spec, match[1]);
        write(destination, spec.extension === "zip" ? zipBuffer([[`${spec.asset.slice(0, -4)}.exe`, binary]]) : gzipSync(binary));
    }
    return { root, cacheRoot, manifestPath, manifest, binaries, requests, download, write, offline: false, log() {} };
}

module.exports = { fixture, binaryFor, zipBuffer };
