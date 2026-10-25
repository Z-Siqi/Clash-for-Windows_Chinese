"use strict";

const { createConnectionModel } = require("../../features/connections/connection-model");
const { normalizeConnectionsSnapshot } = require("../../features/clash-core/core-api-compat");

const model = createConnectionModel({ normalizeSnapshot: normalizeConnectionsSnapshot });
self.onmessage = event => {
    // Dedicated-worker messages use an empty origin. Window-style messages from
    // another origin must never enter this worker's state or command handling.
    if (event.origin !== "") return;
    const { data } = event;
    if (!data || typeof data !== "object" || !Number.isSafeInteger(data.id) || data.id < 1) return;
    try {
        if (data.operation === "beginClose") model.beginClose(data.query);
        if (data.operation === "closeBatch") {
            self.postMessage({ id: data.id, batch: model.closeBatch() });
            return;
        }
        if (data.payload !== undefined) model.ingest(data.payload, data.sampledAt);
        self.postMessage({ id: data.id, view: model.view(data.query) });
    } catch (_error) {
        // Connection metadata and controller payloads must not enter diagnostics.
        self.postMessage({ id: data.id, error: "Could not process connections" });
    }
};
