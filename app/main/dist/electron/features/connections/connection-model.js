"use strict";

const ROW_HEIGHT = 64;
const LABEL_HEIGHT = 32;
const OVERSCAN = 5;
const MAX_VISIBLE = 100;

function windowRange(total, top = 0, height = 600, rowHeight = ROW_HEIGHT) {
    const visible = Math.min(MAX_VISIBLE, Math.max(1, Math.ceil(height / rowHeight)) + OVERSCAN * 2);
    const start = Math.max(0, Math.min(Math.floor(top / rowHeight) - OVERSCAN, total - visible));
    return { start, end: Math.min(total, start + visible), offset: start * rowHeight, height: total * rowHeight };
}

function flattenValues(value) {
    if (!value || typeof value !== "object") return String(value ?? "");
    return Object.values(value).map(flattenValues).join("\n");
}

function createConnectionModel({ normalizeSnapshot = value => value } = {}) {
    let data = { connections: [], uploadTotal: 0, downloadTotal: 0 };
    let byId = new Map();
    let sampledAt;
    let ordered = [];
    let orderKey;
    let labels = [];
    let labelKey;
    let closing = [];
    let closeOffset = 0;
    const timestamps = new WeakMap();

    function ingest(payload, now = Date.now()) {
        const snapshot = normalizeSnapshot(typeof payload === "string" ? JSON.parse(payload) : payload);
        const previous = byId;
        const elapsed = sampledAt === undefined ? 1 : Math.max(0.001, (now - sampledAt) / 1000);
        byId = new Map();
        for (const connection of snapshot.connections || []) {
            const last = previous.get(connection.id);
            connection.speed = {
                upload: last ? Math.max(0, (connection.upload - last.upload) / elapsed) : 0,
                download: last ? Math.max(0, (connection.download - last.download) / elapsed) : 0
            };
            timestamps.set(connection, Date.parse(connection.start) || 0);
            byId.set(connection.id, connection);
        }
        data = snapshot;
        sampledAt = now;
        orderKey = labelKey = undefined;
    }

    function select(query) {
        const search = query.search || "";
        const key = JSON.stringify([query.sort, query.reverse, search]);
        if (key === orderKey) return ordered;
        const exact = /^(.+?)=(.+)$/.exec(search);
        let regex;
        try { regex = search && !exact ? new RegExp(search, "i") : null; } catch (_invalidRegex) {}
        ordered = (data.connections || []).filter(connection => !search || (exact
            ? connection.metadata?.[exact[1]] === exact[2]
            : !regex || regex.test(flattenValues(connection))));
        const destination = connection => connection.metadata?.host || connection.metadata?.destinationIP || "";
        // Worker queries are messages, not trusted property names. Literal cases
        // prevent inherited array methods (for example "sort") being invoked.
        let compare;
        switch (query.sort) {
            case 0: compare = (left, right) => right.speed.upload - left.speed.upload; break;
            case 1: compare = (left, right) => right.speed.download - left.speed.download; break;
            case 2: compare = (left, right) => right.upload - left.upload; break;
            case 3: compare = (left, right) => right.download - left.download; break;
            case 5: compare = (left, right) => destination(right).localeCompare(destination(left)); break;
            default: compare = (left, right) => timestamps.get(left) - timestamps.get(right);
        }
        ordered.sort(compare);
        if (query.reverse) ordered.reverse();
        orderKey = key;
        return ordered;
    }

    function view(query = {}) {
        const matches = select(query);
        const range = windowRange(matches.length, query.top, query.height);
        let labelRange = windowRange(0, 0, 0, LABEL_HEIGHT);
        if (query.showLabels) {
            if (labelKey !== query.field) {
                labels = [...new Set((data.connections || []).map(connection => connection.metadata?.[query.field]))]
                    .filter(Boolean).sort();
                labelKey = query.field;
            }
            labelRange = windowRange(labels.length, query.labelTop, query.labelHeight, LABEL_HEIGHT);
        }
        return {
            revision: query.revision, uploadTotal: data.uploadTotal, downloadTotal: data.downloadTotal,
            total: (data.connections || []).length, count: matches.length, range,
            rows: matches.slice(range.start, range.end),
            detail: byId.get(query.detailId) || null,
            labelRange, labels: query.showLabels ? labels.slice(labelRange.start, labelRange.end) : []
        };
    }

    return {
        ingest, view,
        beginClose(query) { closing = select(query).map(connection => connection.id); closeOffset = 0; },
        closeBatch() {
            const batch = closing.slice(closeOffset, closeOffset + 16);
            closeOffset += batch.length;
            if (closeOffset >= closing.length) { closing = []; closeOffset = 0; }
            return batch;
        }
    };
}

module.exports = { createConnectionModel, windowRange, ROW_HEIGHT, LABEL_HEIGHT, MAX_VISIBLE };
