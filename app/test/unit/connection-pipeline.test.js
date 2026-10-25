"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createConnectionPipeline } = require("../../main/dist/electron/features/connections/connection-pipeline");

function fixture() {
    const sent = [], views = [];
    const worker = { postMessage: message => sent.push(message), terminate() { this.stopped = true; } };
    return { worker, sent, views, pipeline: createConnectionPipeline({ worker, onView: view => views.push(view) }) };
}

test("worker backpressure retains one latest raw snapshot and does not starve live views", () => {
    const { worker, pipeline, sent, views } = fixture();
    pipeline.update({ sort: 4 }, "first");
    for (let index = 0; index < 100; index++) pipeline.update({ sort: 4 }, String(index));
    assert.equal(sent.length, 1);
    worker.onmessage({ data: { id: 1, view: { revision: 1 } } });
    assert.equal(views.length, 1, "new snapshots do not invalidate the current viewport");
    assert.equal(sent.length, 2);
    assert.equal(sent[1].payload, "99");
    pipeline.update({ top: 64000 });
    worker.onmessage({ data: { id: 2, view: { revision: 1 } } });
    assert.equal(views.length, 1, "obsolete viewport is ignored");
    worker.onmessage({ data: { id: 3, view: { revision: 2 } } });
    assert.equal(views.length, 2);
    assert.ok(Object.isFrozen(views[1]));
    pipeline.dispose();
    assert.ok(worker.stopped);
    pipeline.update({}, "ignored");
    assert.equal(sent.length, 3);
});

test("disposing a page rejects pending worker commands and ignores late results", async () => {
    const { worker, pipeline, views } = fixture();
    const first = pipeline.command("beginClose"), second = pipeline.command("closeBatch");
    pipeline.dispose();
    await assert.rejects(first, /stopped/);
    await assert.rejects(second, /stopped/);
    worker.onmessage({ data: { id: 1, view: { revision: 0 } } });
    assert.deepEqual(views, []);
});
