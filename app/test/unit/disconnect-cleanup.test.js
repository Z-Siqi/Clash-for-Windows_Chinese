"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { prepareDisconnectCleanup } = require("../../main/dist/electron/features/connections/disconnect-cleanup");

function setup() {
    const closed = [], errors = [];
    let reads = 0;
    const api = {
        isReady: () => true,
        getConnections: async options => { reads++; assert.equal(options.timeout, 1000); return { status: 200, data: { connections: [{ id: "old" }, { id: "old" }, {}, null] } }; },
        closeConnection: async (id, options) => { assert.equal(options.timeout, 1000); closed.push(id); return { status: 204 }; }
    };
    return { api, closed, errors, reads: () => reads, options: { api, settings: {}, disconnecting: true, onError: (...args) => errors.push(args) } };
}

test("disconnect cleanup snapshots once and closes only pre-existing IDs after success", async () => {
    const h = setup();
    const finish = await prepareDisconnectCleanup(h.options);
    assert.deepEqual(h.closed, []);
    h.api.getConnections = async () => { throw Error("must not include new connections"); };
    await finish(true);
    await finish(true);
    assert.deepEqual(h.closed, ["old"]);
    assert.equal(h.reads(), 1);
});

test("enabling, unchanged state, disabled preference and offline core never request closure", async () => {
    for (const change of [{ disconnecting: false }, { disconnecting: undefined }, { settings: { connProxyDisconnect: false } }, { api: null }]) {
        const h = setup();
        await (await prepareDisconnectCleanup({ ...h.options, ...change }))(true);
        assert.equal(h.reads(), 0);
        assert.deepEqual(h.closed, []);
    }
    const h = setup(); h.api.isReady = () => false;
    await (await prepareDisconnectCleanup(h.options))(true);
    assert.equal(h.reads(), 0);
});

test("unsuccessful proxy disable preserves every connection", async () => {
    const h = setup();
    await (await prepareDisconnectCleanup(h.options))(false);
    assert.deepEqual(h.closed, []);
});

test("controller failures do not block proxy disable and never report request credentials", async () => {
    const h = setup();
    h.api.getConnections = async () => { throw Error("request credentials must stay private"); };
    await (await prepareDisconnectCleanup(h.options))(true);
    assert.deepEqual(h.errors, [[]]);
    assert.deepEqual(h.closed, []);
    h.errors.length = 0;
    h.api.getConnections = async () => ({ status: 200, data: { connections: [{ id: "gone" }, { id: "failed" }, { id: "ok" }] } });
    h.api.closeConnection = async id => {
        if (id === "gone") throw { response: { status: 404 } };
        if (id === "failed") throw Error("private request");
        h.closed.push(id); return { status: 204 };
    };
    await (await prepareDisconnectCleanup(h.options))(true);
    assert.deepEqual(h.closed, ["ok"]);
    assert.deepEqual(h.errors, [[]]);
});

test("connection deletion concurrency is bounded", async () => {
    const h = setup();
    let active = 0, peak = 0;
    h.api.getConnections = async () => ({ status: 200, data: { connections: Array.from({ length: 33 }, (_, id) => ({ id: String(id) })) } });
    h.api.closeConnection = async id => {
        active++; peak = Math.max(peak, active);
        await new Promise(resolve => setImmediate(resolve));
        active--; h.closed.push(id); return { status: 204 };
    };
    await (await prepareDisconnectCleanup(h.options))(true);
    assert.ok(peak <= 8);
    assert.equal(h.closed.length, 33);
});
