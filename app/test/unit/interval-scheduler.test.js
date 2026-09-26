"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createIntervalScheduler } = require("../../main/dist/electron/core/runtime/interval-scheduler");

test("interval scheduler pauses, resumes and permanently stops tasks", () => {
    let active = true, nextId = 0;
    const started = [], cleared = [];
    const scheduler = createIntervalScheduler({
        isActive: () => active,
        createId: () => `task-${++nextId}`,
        setIntervalFn: (callback, interval) => {
            const handle = { callback, interval, id: started.length + 1 };
            started.push(handle);
            return handle;
        },
        clearIntervalFn: handle => cleared.push(handle)
    });
    const first = scheduler.add(() => {}, 1000);
    assert.equal(started.length, 1);
    scheduler.pause(first);
    assert.equal(scheduler.getAll()[0].intervalId, -1);
    scheduler.resume(first);
    assert.equal(started.length, 2);
    scheduler.pause(first);
    scheduler.stop(first);
    assert.equal(scheduler.getAll().length, 0, "stopping a paused page task must prevent later resume");
    active = false;
    const second = scheduler.add(() => {}, 2000);
    assert.equal(scheduler.getAll()[0].intervalId, -1);
    scheduler.resumeAll();
    assert.equal(started.length, 3);
    scheduler.stopAll();
    assert.equal(scheduler.getAll().length, 0);
    assert.equal(second, "task-2");
    assert.equal(cleared.length, 3);
});
