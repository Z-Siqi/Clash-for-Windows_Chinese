"use strict";

function normalizeExternalUrl(value, { allowLoopbackHttp = false } = {}) {
    let parsed;
    try {
        parsed = new URL(String(value));
    } catch (_error) {
        return null;
    }
    if (parsed.protocol === "https:") return parsed.toString();
    if (
        allowLoopbackHttp &&
        parsed.protocol === "http:" &&
        ["127.0.0.1", "[::1]", "localhost"].includes(parsed.hostname)
    ) {
        return parsed.toString();
    }
    return null;
}

module.exports = { normalizeExternalUrl };
