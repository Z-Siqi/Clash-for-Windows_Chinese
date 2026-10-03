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

    // Scan once: overlapping escape alternatives in a regex can backtrack
    // exponentially on malformed core output (including remote hostnames).
    const entries = scanLogFields(line);
    if (!entries || entries.length < 3 || entries[0].key !== "time"
        || entries[1].key !== "level" || entries[2].key !== "msg") return null;
    const [time, level, message, ...fields] = entries;
    const timeMatch = time.value.match(/T(\d{2}:\d{2}:\d{2})/);
    return normalizeStructuredLog({
        time: timeMatch ? timeMatch[1] : time.value,
        level: level.value,
        message: message.value,
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

function scanLogFields(line) {
    const fields = [];
    let index = 0;
    const whitespace = character => /\s/.test(character);
    while (index < line.length) {
        while (index < line.length && whitespace(line[index])) index++;
        if (index === line.length) break;
        const start = index;
        while (index < line.length && line[index] !== "=" && !whitespace(line[index])) index++;
        if (index === start || line[index] !== "=") return null;
        const key = line.slice(start, index++);
        let value = "";
        if (line[index] === '"') {
            index++;
            let closed = false;
            while (index < line.length) {
                const character = line[index++];
                if (character === '"') { closed = true; break; }
                if (character === "\\" && index < line.length) {
                    const next = line[index++];
                    value += next === '"' || next === "\\" ? next : `\\${next}`;
                } else value += character;
            }
            if (!closed || (index < line.length && !whitespace(line[index]))) return null;
        } else {
            const valueStart = index;
            while (index < line.length && !whitespace(line[index])) index++;
            value = line.slice(valueStart, index);
            if (!value) return null;
        }
        fields.push({ key, value });
    }
    return fields;
}

module.exports = {
    normalizeCoreVersion,
    normalizeStructuredLog,
    parseCoreLogLine,
    normalizeConnectionsSnapshot
};
