"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { createConnectionModel, windowRange, MAX_VISIBLE } = require("../../main/dist/electron/features/connections/connection-model");
const { normalizeConnectionsSnapshot } = require("../../main/dist/electron/features/clash-core/core-api-compat");
const { largeConnections } = require("../fixtures/large-connections");

test("100,000 connections: linear previous-ID lookup, bounded viewport, full search and detail", t => {
    const model = createConnectionModel({ normalizeSnapshot: normalizeConnectionsSnapshot });
    model.ingest({ connections: largeConnections(), uploadTotal: 12 }, 1000);
    const input = largeConnections(100000, 2048).reverse();
    // A regression to Array.find(previous) fails immediately instead of hanging the suite.
    const originalFind = Array.prototype.find;
    Array.prototype.find = () => { throw Error("quadratic previous connection lookup"); };
    const started = performance.now();
    try { model.ingest({ connections: input, uploadTotal: 24 }, 3000); }
    finally { Array.prototype.find = originalFind; }
    const view = model.view({ sort: 4, detailId: "connection-99999", top: 6400000 });
    assert.equal(view.count, 100000);
    assert.ok(view.rows.length <= MAX_VISIBLE);
    assert.equal(view.rows.at(-1).id, "connection-99999");
    assert.equal(view.detail.speed.upload, 1024);
    assert.equal(view.detail.speed.download, 2048);
    const searched = model.view({ search: "host-99999", sort: 4 });
    assert.equal(searched.count, 1);
    assert.equal(searched.rows[0].id, "connection-99999");
    const exact = model.view({ search: "network=udp", sort: 3, showLabels: true, field: "host", labelTop: 3200000 });
    assert.equal(exact.count, 50000);
    assert.equal(exact.rows[0].id, "connection-99999");
    assert.ok(exact.labels.length <= MAX_VISIBLE);
    assert.equal(exact.labelRange.height, 3200000);
    assert.equal(model.view({ search: "[", sort: 4 }).count, 100000, "invalid regex preserves legacy match-all behavior");
    t.diagnostic(`100k ingest/sort/filter: ${(performance.now() - started).toFixed(1)}ms in worker model`);
});

test("sorting, reversal, counter resets and stable filtered-close batches", () => {
    const model = createConnectionModel();
    model.ingest({ connections: largeConnections(35, 100) }, 1000);
    model.ingest({ connections: largeConnections(35) }, 2000);
    assert.equal(model.view({ sort: 0 }).rows[0].speed.upload, 0);
    assert.equal(model.view({ sort: 4, reverse: true }).rows[0].id, "connection-34");
    model.beginClose({ search: "network=tcp", sort: 4 });
    model.ingest({ connections: [] }, 3000);
    const first = model.closeBatch(), second = model.closeBatch();
    assert.equal(first.length, 16);
    assert.deepEqual(second, ["connection-32", "connection-34"]);
    assert.deepEqual(model.closeBatch(), []);
    assert.equal(model.view({ detailId: "connection-34" }).detail, null);
    assert.deepEqual(windowRange(0), { start: 0, end: 0, height: 0, offset: 0 });
    assert.ok(windowRange(100000, 0, 1000000).end <= MAX_VISIBLE);
});

test("sort messages accept only supported numeric choices without invoking inherited methods", () => {
    const model = createConnectionModel();
    model.ingest({ connections: largeConnections(5).reverse() });
    for (const sort of ["sort", "reverse", "constructor", "__proto__", "toString", "0", -1, 99, null, {}]) {
        const view = model.view({ sort });
        assert.deepEqual(view.rows.map(row => row.id), ["connection-0", "connection-1", "connection-2", "connection-3", "connection-4"]);
        model.beginClose({ sort });
        assert.equal(model.closeBatch().length, 5);
    }
    for (const sort of [0, 1, 2, 3, 4, 5]) assert.equal(model.view({ sort }).count, 5);
});
