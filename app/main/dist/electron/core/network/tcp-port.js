"use strict";

const MIN_PORT = 1;
const MAX_PORT = 65535;

function parsePort(value) {
    const text = String(value == null ? "" : value).trim();
    if (!/^\d+$/.test(text)) return null;
    const port = Number(text);
    return Number.isSafeInteger(port) && port >= MIN_PORT && port <= MAX_PORT
        ? port : null;
}

module.exports = { MIN_PORT, MAX_PORT, parsePort };
