"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createCoreStatusPoller } = require("../../main/dist/electron/features/home/core-status-poller");

function fixture() {
    const updates = [];
    let calls = 0, answer = "disconnected";
    const vm = { coreRunRevision: 1, controllerPort: 12345, profileApplyRevision: 0, coreStatusPending: false,
        clashStatus: "connected", isWindowShow: true, clashAxiosFlyingRequestCount: 0,
        async getClashStatus() { calls++; return typeof answer === "function" ? answer() : answer; },
        setClashStatus({ status }) { updates.push(status); this.clashStatus = status; } };
    return { vm, updates, poll: createCoreStatusPoller(vm, { CONNECTED: "connected", DISCONNECTED: "disconnected" }),
        get calls() { return calls; }, answer(value) { answer = value; } };
}

test("startup and slow configuration application cannot accumulate disconnection observations", async () => {
    const h = fixture();
    for (let i = 0; i < 4; i++) await h.poll();
    h.vm.coreStatusPending = true;
    for (let i = 0; i < 20; i++) await h.poll();
    assert.equal(h.calls, 4, "background probes must not contend with an owned readiness operation");
    assert.deepEqual(h.updates, []);
    h.vm.coreStatusPending = false;
    for (let i = 0; i < 4; i++) await h.poll();
    assert.deepEqual(h.updates, [], "the previous failure streak must be retired");
    await h.poll();
    assert.deepEqual(h.updates, ["disconnected"], "a real failure after initialization must remain observable");
    h.answer("connected"); await h.poll();
    assert.deepEqual(h.updates, ["disconnected", "connected"]);
});

test("late probes cannot publish results across reloads, restarts or controller changes", async () => {
    for (const change of [vm => { vm.profileApplyRevision++; }, vm => { vm.coreRunRevision++; }, vm => { vm.controllerPort++; },
        vm => { vm.coreStatusPending = true; }]) {
        const h = fixture();
        for (let i = 0; i < 4; i++) await h.poll();
        let release;
        h.answer(() => new Promise(resolve => { release = resolve; }));
        const pending = h.poll();
        change(h.vm);
        release("disconnected"); await pending;
        assert.deepEqual(h.updates, []);
        h.vm.coreStatusPending = false;
        h.answer("disconnected"); await h.poll();
        assert.deepEqual(h.updates, []);
    }
});

test("a completed reload between polls starts a new failure streak", async () => {
    const h = fixture();
    for (let i = 0; i < 4; i++) await h.poll();
    h.vm.profileApplyRevision++;
    await h.poll();
    assert.deepEqual(h.updates, []);
});

test("status probes coalesce while pending and a responding controller resets failures", async () => {
    const h = fixture();
    let release;
    h.answer(() => new Promise(resolve => { release = resolve; }));
    const pending = h.poll();
    await Promise.all(Array.from({ length: 10 }, () => h.poll()));
    assert.equal(h.calls, 1);
    release("disconnected"); await pending;
    h.answer("connected"); await h.poll();
    h.answer("disconnected");
    for (let i = 0; i < 4; i++) await h.poll();
    assert.deepEqual(h.updates, ["connected"]);
});

test("hidden connected windows and saturated request queues do not add status probes", async () => {
    const h = fixture();
    h.vm.isWindowShow = false; await h.poll();
    h.vm.isWindowShow = true; h.vm.clashAxiosFlyingRequestCount = 5; await h.poll();
    assert.equal(h.calls, 0);
});
