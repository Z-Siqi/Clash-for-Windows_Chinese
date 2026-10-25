"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLatencyPolicy } = require("../../main/dist/electron/features/proxies/latency-policy");

test("Mihomo mean mode uses two samples within one budget; default and legacy mean use one API call", async () => {
    let time = 1000;
    const policy = createLatencyPolicy({ now: () => time });
    const budgets = [], values = [20, 80];
    assert.equal(await policy.measure({ name: "node", core: "mihomo", kind: "meanDelay", timeout: 1000,
        sample: async remaining => { budgets.push(remaining); time += 100; return { delay: values.shift() }; } }), 50);
    assert.deepEqual(budgets, [1000, 900]);
    let calls = 0;
    assert.equal(await policy.measure({ name: "node", core: "mihomo", kind: "delay", timeout: 1000,
        sample: async () => { calls++; return { delay: 22 }; } }), 22);
    assert.equal(await policy.measure({ name: "node", core: "clash", kind: "meanDelay", timeout: 1000,
        sample: async () => { calls++; return { delay: 22, meanDelay: 0 }; } }), 0);
    assert.equal(calls, 2);
});

test("failed second samples and an exhausted overall budget do not fall back to the first delay", async () => {
    for (const failed of ["zero", "error", "budget"]) {
        let time = 0, calls = 0;
        const policy = createLatencyPolicy({ now: () => time });
        const value = await policy.measure({ name: "node", core: "mihomo", kind: "meanDelay", timeout: 1000,
            sample: async () => {
                if (++calls === 1) { time += failed === "budget" ? 1000 : 10; return { delay: 20 }; }
                if (failed === "error") throw new Error("timeout");
                return { delay: 0 };
            } });
        assert.equal(value, 0); assert.equal(calls, failed === "budget" ? 1 : 2);
    }
});

test("cancellation or a changed page after the first sample never issues the second request or stores its result", async () => {
    const policy = createLatencyPolicy();
    let current = true, calls = 0;
    await assert.rejects(policy.measure({ name: "node", core: "mihomo", kind: "meanDelay", timeout: 1000,
        current: () => current, sample: async () => { calls++; current = false; return { delay: 20 }; } }), { code: "ERR_CANCELED" });
    assert.equal(calls, 1);
    assert.equal(policy.read({ name: "node", kind: "meanDelay" }), undefined);
});

test("paired means bind to exact native history, remain provider-specific, and expire with a later measurement", async () => {
    let time = 10000;
    const policy = createLatencyPolicy({ now: () => time });
    policy.setScope(["mihomo", "profile", 1]);
    let calls = 0;
    await policy.measure({ name: "same", provider: { name: "first" }, core: "mihomo", kind: "meanDelay", timeout: 1000,
        sample: async () => { time += 100; return { delay: ++calls === 1 ? 20 : 80 }; } });
    const read = extra => policy.read({ name: "same", provider: { name: "first" }, kind: "meanDelay", ...extra });
    assert.equal(read({ history: [{ time: new Date(9000).toISOString(), delay: 7 }] }), 50);
    assert.equal(read({ history: [{ time: "1970-01-01T00:00:10.2001234Z", delay: 80 }] }), 50);
    assert.equal(policy.read({ name: "same", provider: { name: "second" }, kind: "meanDelay" }), undefined);
    assert.equal(read({ history: [{ time: "1970-01-01T00:00:10.2001235Z", delay: 80 }] }), undefined, "preserve submillisecond native timestamps when detecting a new test");
    assert.equal(read({ history: [{ delay: 40 }] }), undefined, "missing means are untested, not timeouts or undefined ms");
    assert.equal(read({ history: [{ delay: 0 }] }), 0);
    policy.setScope(["mihomo", "profile", 2]);
    assert.equal(read(), undefined);
});

test("an automatic check after the pair cannot bind an old mean even when its delay is identical", async () => {
    let time = 10000, calls = 0;
    const policy = createLatencyPolicy({ now: () => time });
    await policy.measure({ name: "node", core: "mihomo", kind: "meanDelay", timeout: 1000,
        sample: async () => { time += 100; return { delay: ++calls === 1 ? 100 : 20 }; } });
    assert.equal(policy.read({ name: "node", kind: "meanDelay", history: [{ time: new Date(time + 60).toISOString(), delay: 20 }] }), undefined);
});
