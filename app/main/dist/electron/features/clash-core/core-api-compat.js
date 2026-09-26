"use strict";

const LEVELS = Object.freeze({
    ERR: "error",
    WRN: "warn",
    INF: "info",
    DBG: "debug",
    TRC: "trace",
    FTL: "fatal"
});

function normalizeCoreVersion(data = {}, coreType = "clash") {
    const version = typeof data.version === "string" ? data.version.trim() : "";
    if (!version) return "Unknown";
    if (coreType === "mihomo" || data.meta === true) return `Mihomo ${version}`;
    if (data.premium === true) return `${version} Premium`;
    return version;
}

function normalizeStructuredLog(entry = {}) {
    const rawFields = entry.fields;
    const fields = Array.isArray(rawFields)
        ? rawFields
        : rawFields && typeof rawFields === "object"
            ? Object.entries(rawFields).map(([key, value]) => ({ key, value: String(value) }))
            : [];
    return {
        level: entry.level || entry.type || "info",
        message: entry.message || entry.payload || "",
        time: entry.time || "",
        fields
    };
}

function parseCoreLogLine(line) {
    if (typeof line !== "string" || line.trim() === "") return null;
    const legacy = line.match(/^(\S+)\s+(ERR|WRN|INF|DBG|TRC|FTL)\s+(.+)$/);
    if (legacy) {
        return normalizeStructuredLog({
            time: legacy[1],
            level: LEVELS[legacy[2]],
            payload: legacy[3]
        });
    }

    const mihomo = line.match(/^time="([^"]+)"\s+level=([^\s]+)\s+msg="((?:\\.|[^"])*)"(.*)$/);
    if (!mihomo) return null;
    const fields = [];
    const tail = mihomo[4];
    const fieldPattern = /([^\s=]+)=("(?:\\.|[^"])*"|[^\s]+)/g;
    let match;
    while ((match = fieldPattern.exec(tail))) {
        fields.push({ key: match[1], value: unquoteLogValue(match[2]) });
    }
    const timeMatch = mihomo[1].match(/T(\d{2}:\d{2}:\d{2})/);
    return normalizeStructuredLog({
        time: timeMatch ? timeMatch[1] : mihomo[1],
        level: mihomo[2],
        message: unescapeLogValue(mihomo[3]),
        fields
    });
}

function normalizeConnectionsSnapshot(snapshot = {}) {
    const connections = Array.isArray(snapshot.connections) ? snapshot.connections : [];
    return {
        ...snapshot,
        uploadTotal: Number(snapshot.uploadTotal) || 0,
        downloadTotal: Number(snapshot.downloadTotal) || 0,
        connections: connections.map(connection => ({
            ...connection,
            chains: Array.isArray(connection.chains) ? connection.chains : [],
            metadata: connection.metadata && typeof connection.metadata === "object"
                ? connection.metadata : {}
        }))
    };
}

function unquoteLogValue(value) {
    return value.startsWith('"') && value.endsWith('"')
        ? unescapeLogValue(value.slice(1, -1)) : value;
}

function unescapeLogValue(value) {
    return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

module.exports = {
    normalizeCoreVersion,
    normalizeStructuredLog,
    parseCoreLogLine,
    normalizeConnectionsSnapshot
};
