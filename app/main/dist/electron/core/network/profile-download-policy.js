"use strict";

const MIB = 1024 * 1024;
const DEFAULT_DOWNLOAD_POLICY = Object.freeze({ maxContentLength: 16 * MIB, timeout: 60000, workerTimeout: 120000 });
const LIMITS = Object.freeze({ maxSizeMiB: [16, 256], timeoutSeconds: [60, 1800], processingTimeoutSeconds: [120, 3600] });

function readDownloadExceptions({ yaml, text }) {
    if (text == null || text === "") return [];
    if (typeof text !== "string" || text.length > 262144) throw new Error("Download exceptions must be a YAML document under 256 KiB");
    let document;
    try { document = yaml.parse(text); } catch { throw new Error("Invalid download exceptions YAML"); }
    if (document == null) return [];
    if (typeof document !== "object" || Array.isArray(document) || Object.keys(document).some(key => key !== "exceptions")) {
        throw new Error("Use an exceptions array");
    }
    const entries = document.exceptions ?? [];
    if (!Array.isArray(entries) || entries.length > 128) throw new Error("exceptions must contain at most 128 entries");
    return entries.map((entry, index) => {
        const field = `exceptions[${index}]`;
        if (!entry || typeof entry !== "object" || Array.isArray(entry)
            || Object.keys(entry).some(key => key !== "url" && !Object.hasOwn(LIMITS, key))) throw new Error(`${field} has unknown fields`);
        let url;
        try { url = new URL(entry.url); } catch { throw new Error(`${field}.url must be a complete HTTP or HTTPS URL`); }
        if (typeof entry.url !== "string" || entry.url.length > 8192 || !["http:", "https:"].includes(url.protocol) || url.hash) {
            throw new Error(`${field}.url must be a complete HTTP or HTTPS URL without a fragment`);
        }
        for (const [key, [minimum, maximum]] of Object.entries(LIMITS)) {
            if (entry[key] !== undefined && (!Number.isInteger(entry[key]) || entry[key] < minimum || entry[key] > maximum)) {
                throw new Error(`${field}.${key} must be an integer in ${minimum}..${maximum}`);
            }
        }
        const timeout = (entry.timeoutSeconds ?? 60) * 1000;
        return { url: url.href,
            maxContentLength: (entry.maxSizeMiB ?? 16) * MIB, timeout,
            // Raising the HTTP timeout must also leave time for parsing and saving.
            workerTimeout: Math.max((entry.processingTimeoutSeconds ?? 120) * 1000, timeout + 60000)
        };
    });
}

function resolveDownloadPolicy({ settings, yaml, url }) {
    try {
        const target = new URL(url).href;
        const entries = readDownloadExceptions({ yaml, text: settings?.profileDownloadExceptionsText });
        return entries.find(entry => entry.url === target) || DEFAULT_DOWNLOAD_POLICY;
    } catch { return DEFAULT_DOWNLOAD_POLICY; }
}

module.exports = { DEFAULT_DOWNLOAD_POLICY, readDownloadExceptions, resolveDownloadPolicy };
