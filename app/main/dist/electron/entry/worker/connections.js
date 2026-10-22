"use strict";

const { createConnectionModel } = require("../../features/connections/connection-model");
const { normalizeConnectionsSnapshot } = require("../../features/clash-core/core-api-compat");

const model = createConnectionModel({ normalizeSnapshot: normalizeConnectionsSnapshot });
self.onmessage = ({ data }) => {
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
