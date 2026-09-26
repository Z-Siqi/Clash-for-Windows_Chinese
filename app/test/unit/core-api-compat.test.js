"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const {
    normalizeCoreVersion,
    normalizeStructuredLog,
    parseCoreLogLine,
    normalizeConnectionsSnapshot
} = require(path.join(root, "app/main/dist/electron/features/clash-core/core-api-compat"));

assert.equal(normalizeCoreVersion({ meta: true, version: "v1.19.31" }, "mihomo"), "Mihomo v1.19.31");
assert.equal(normalizeCoreVersion({ premium: true, version: "2023.08.17" }, "clash"), "2023.08.17 Premium");
assert.equal(normalizeCoreVersion({}, "mihomo"), "Unknown");

assert.deepEqual(normalizeStructuredLog({
    time: "13:29:14",
    level: "debug",
    message: "request",
    fields: { network: "tcp", destination: "example.com" }
}), {
    time: "13:29:14",
    level: "debug",
    message: "request",
    fields: [
        { key: "network", value: "tcp" },
        { key: "destination", value: "example.com" }
    ]
});

assert.deepEqual(parseCoreLogLine(
    'time="2026-09-22T13:29:14.330153600+08:00" level=info msg="[TCP] example.com" network=tcp'
), {
    time: "13:29:14",
    level: "info",
    message: "[TCP] example.com",
    fields: [{ key: "network", value: "tcp" }]
});
assert.deepEqual(parseCoreLogLine("13:29:14 INF [TCP] example.com"), {
    time: "13:29:14",
    level: "info",
    message: "[TCP] example.com",
    fields: []
});

assert.deepEqual(normalizeConnectionsSnapshot({
    uploadTotal: 0,
    downloadTotal: 0,
    connections: null,
    memory: 0
}), {
    uploadTotal: 0,
    downloadTotal: 0,
    connections: [],
    memory: 0
});

const normalizedConnection = normalizeConnectionsSnapshot({
    connections: [{ id: "1", chains: null, metadata: null }]
});
assert.deepEqual(normalizedConnection.connections[0].chains, []);
assert.deepEqual(normalizedConnection.connections[0].metadata, {});

const renderer = readRendererCompositionSource(root);
const generalWorkflow = fs.readFileSync(path.join(
    root, "app/main/dist/electron/features/clash-core/general-page-workflow.js"
), "utf8");
const logsPage = fs.readFileSync(path.join(
    root, "app/main/dist/electron/features/logs/page.js"
), "utf8");
const connectionsPage = fs.readFileSync(path.join(
    root, "app/main/dist/electron/features/connections/page.js"
), "utf8");
assert.match(renderer, /features\/clash-core\/core-api-compat/);
assert.match(renderer, /features\/clash-core\/general-page-workflow/);
assert.match(generalWorkflow, /normalizeCoreVersion\(response\.data, this\.settings\.proxyCore\)/);
assert.match(logsPage, /normalizeStructuredLog\(JSON\.parse\(payload\)\)/);
assert.match(logsPage, /parseCoreLogLine\(line\)/);
assert.match(connectionsPage, /normalizeConnectionsSnapshot\(JSON\.parse\(payload\)\)/);

console.log("core API compatibility smoke: PASS");
