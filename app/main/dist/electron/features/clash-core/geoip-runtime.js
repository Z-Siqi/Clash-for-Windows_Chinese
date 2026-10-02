"use strict";

const { writeAtomic } = require("../../core/storage/atomic-file");

function createGeoipRuntime({ fs, path, got, zlib, tarStream }) {
    const limit = 33554432;
    const marker = Buffer.from([171, 205, 239, ...Buffer.from("MaxMind.com")]);
    function download(url, onProgress) {
        return new Promise((resolve, reject) => {
            const stream = got.stream(url, { timeout: { request: 120000 }, retry: { limit: 0 } });
            const chunks = []; let size = 0;
            stream.on("downloadProgress", progress => onProgress(Math.max(0, Math.min(1, progress.percent || 0))));
            stream.on("data", chunk => {
                size += chunk.length;
                if (size > limit) stream.destroy(new Error("GeoIP download is too large"));
                else chunks.push(chunk);
            });
            stream.once("error", reject);
            stream.once("end", () => resolve(Buffer.concat(chunks)));
        });
    }
    function extractDatabase(compressed) {
        const content = zlib.gunzipSync(compressed, { maxOutputLength: 134217728 });
        return new Promise((resolve, reject) => {
            const archive = tarStream.extract();
            let database; let matches = 0;
            archive.on("entry", (header, entry, next) => {
                entry.once("error", reject);
                if (path.posix.basename(header.name) !== "GeoLite2-Country.mmdb") { entry.once("end", next); entry.resume(); return; }
                if (++matches > 1 || header.size > limit) { archive.destroy(new Error("Invalid GeoIP archive")); entry.resume(); return; }
                const chunks = []; let size = 0;
                entry.on("data", chunk => {
                    size += chunk.length;
                    if (size > limit) archive.destroy(new Error("GeoIP database is too large"));
                    else chunks.push(chunk);
                });
                entry.once("end", () => { database = Buffer.concat(chunks); next(); });
            });
            archive.once("error", reject);
            archive.once("finish", () => database ? resolve(database) : reject(new Error("GeoIP database is absent")));
            archive.end(content);
        });
    }
    return {
        async update({ home, url = "", token = "", onProgress = () => {} }) {
            if (typeof token !== "string" || token.length > 4096 || typeof url !== "string") throw new Error("Invalid GeoIP download request");
            const targetUrl = token ? `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=${encodeURIComponent(token)}&suffix=tar.gz` : url;
            if (!["http:", "https:"].includes(new URL(targetUrl).protocol)) throw new Error("Unsupported GeoIP URL");
            const body = await download(targetUrl, onProgress);
            const database = token ? await extractDatabase(body) : body;
            if (database.length < 128 || !database.subarray(Math.max(0, database.length - 131072)).includes(marker)) throw new Error("GeoIP metadata signature is absent");
            // Archive names never become output paths; only the application's fixed database is replaced.
            writeAtomic({ fs, path, file: path.join(home, "Country.mmdb"), content: database });
            onProgress(1);
            return fs.statSync(path.join(home, "Country.mmdb")).mtimeMs;
        }
    };
}

module.exports = { createGeoipRuntime };
