"use strict";

const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { createGunzip } = require("node:zlib");

const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
const MAX_BINARY_BYTES = 256 * 1024 * 1024;

function sizeLimit(maximum) {
    let received = 0;
    return new Transform({
        transform(chunk, encoding, callback) {
            received += chunk.length;
            callback(received > maximum ? new Error("Mihomo download exceeds the size limit") : null, chunk);
        }
    });
}

async function downloadFile(source, destination, {
    request = https.get,
    env = process.env,
    timeout = 180000,
    maximum = MAX_ARCHIVE_BYTES
} = {}) {
    const signal = AbortSignal.timeout(timeout);
    let url = new URL(source);
    let proxyAgent;
    try {
        for (let redirects = 0; redirects <= 8; redirects++) {
            if (url.protocol !== "https:" || url.username || url.password) {
                throw new Error("Mihomo downloads require an HTTPS URL without credentials");
            }
            const proxy = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
            if (proxy && !proxyAgent) {
                const { HttpsProxyAgent } = require("https-proxy-agent");
                proxyAgent = new HttpsProxyAgent(proxy);
            }
            const response = await new Promise((resolve, reject) => {
                const req = request(url, {
                    agent: proxyAgent,
                    signal,
                    headers: { "User-Agent": "CFW-Mihomo-Dependency", Accept: "application/octet-stream" }
                }, resolve);
                req.on("error", reject);
                req.setTimeout(30000, () => req.destroy(new Error("Mihomo download timed out")));
            });
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                response.resume();
                if (!response.headers.location) throw new Error("Mihomo download redirect has no location");
                url = new URL(response.headers.location, url);
                continue;
            }
            if (response.statusCode !== 200) {
                response.resume();
                throw new Error(`Mihomo download failed (HTTP ${response.statusCode})`);
            }
            if (Number(response.headers["content-length"]) > maximum) {
                response.destroy();
                throw new Error("Mihomo download exceeds the size limit");
            }
            await pipeline(response, sizeLimit(maximum), fs.createWriteStream(destination, { flags: "wx" }), { signal });
            return;
        }
        throw new Error("Too many Mihomo download redirects");
    } finally {
        proxyAgent?.destroy();
    }
}

async function extractBinary(archive, destination, target) {
    if (target.asset.endsWith(".gz")) {
        await pipeline(fs.createReadStream(archive), createGunzip(), sizeLimit(MAX_BINARY_BYTES),
            fs.createWriteStream(destination, { flags: "wx", mode: 0o755 }));
        return;
    }
    const yauzl = require("yauzl");
    const zip = await yauzl.openPromise(archive, { autoClose: false, strictFileNames: true });
    try {
        let executable;
        for await (const entry of zip.eachEntry()) {
            if (!/^mihomo[^/]*\.exe$/.test(path.posix.basename(entry.fileName))) continue;
            const type = (entry.externalFileAttributes >>> 16) & 0xf000;
            if (executable || (type && type !== 0x8000) || entry.uncompressedSize > MAX_BINARY_BYTES) {
                throw new Error("Mihomo ZIP must contain exactly one regular core executable");
            }
            executable = entry;
        }
        if (!executable) throw new Error("Mihomo ZIP contains no core executable");
        // Write to our own fixed filename; archive paths are never extracted to disk.
        await pipeline(await zip.openReadStreamPromise(executable), sizeLimit(MAX_BINARY_BYTES),
            fs.createWriteStream(destination, { flags: "wx", mode: 0o755 }));
    } finally {
        zip.close();
    }
}

module.exports = { downloadFile, extractBinary };
