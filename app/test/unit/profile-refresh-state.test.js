"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { trackProfileRefresh, readStableProfileState } = require("../../main/dist/electron/core/network/profile-refresh-state");

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

test("entering Proxies during queued TUN refreshes waits for restored selection", async () => {
    const api = {};
    const first = deferred();
    const second = deferred();
    let selected = "default";
    let reads = 0;
    trackProfileRefresh(api, first.promise);
    const reading = readStableProfileState(api, async () => { reads++; return selected; });
    trackProfileRefresh(api, second.promise);
    first.resolve();
    await Promise.resolve();
    assert.equal(reads, 0);
    selected = "chosen";
    second.resolve();
    assert.equal(await reading, "chosen");
    assert.equal(reads, 1);
});

test("a controller response overlapping a refresh is discarded and read again", async () => {
    const api = {};
    const response = deferred();
    const refresh = deferred();
    let reads = 0;
    const reading = readStableProfileState(api, () => ++reads === 1 ? response.promise : "chosen");
    trackProfileRefresh(api, refresh.promise);
    response.resolve("default");
    refresh.resolve();
    assert.equal(await reading, "chosen");
    assert.equal(reads, 2);
});

test("failed refreshes release readers and other controller instances remain independent", async () => {
    const api = {};
    trackProfileRefresh(api, Promise.reject(new Error("offline")));
    assert.equal(await readStableProfileState({}, async () => "other"), "other");
    assert.equal(await readStableProfileState(api, async () => "previous"), "previous");
});
