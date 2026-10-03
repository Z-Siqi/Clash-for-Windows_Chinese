"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { waitForInitialConfig } = require("../fixtures/core-startup-readiness");

test("core startup does not treat a responding controller with unapplied YAML as ready", async () => {
    let clock = 0, requests = 0;
    await waitForInitialConfig({
        child: { exitCode: null }, mixedPort: 12345, now: () => clock,
        delay: async () => { clock += 20; },
        request: async () => {
            requests++;
            return { status: 200, data: JSON.stringify({ "mixed-port": clock < 60 ? 0 : 12345, mode: "direct" }) };
        }
    });
    assert.equal(clock, 60);
    assert.equal(requests, 4);
});

test("core startup readiness is bounded and detects an exited core", async () => {
    let clock = 0;
    await assert.rejects(waitForInitialConfig({
        child: { exitCode: null }, mixedPort: 12345, now: () => clock, timeout: 40,
        delay: async () => { clock += 20; },
        request: async () => ({ status: 200, data: '{"mixed-port":0,"mode":"direct"}' })
    }), /did not become ready/);
    await assert.rejects(waitForInitialConfig({ child: { exitCode: 1 }, mixedPort: 12345, request: async () => assert.fail("No request after exit") }), /Core exited/);
});
