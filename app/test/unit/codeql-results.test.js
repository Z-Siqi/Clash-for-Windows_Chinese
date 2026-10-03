"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { inspectCodeqlReport, checkDirectory } = require("../../../scripts/security/check-codeql-results");

function report(overrides = {}) {
    return { version: "2.1.0", runs: [{
        tool: { driver: { name: "CodeQL", rules: [{ id: "security-query" }] } },
        results: [], invocations: [{ executionSuccessful: true }], ...overrides
    }] };
}

test("CodeQL gate rejects findings even when the analyzer exited successfully", () => {
    assert.deepEqual(inspectCodeqlReport(report()), { runs: 1, rules: 1 });
    assert.throws(() => inspectCodeqlReport(report({ results: [{ ruleId: "security-query", level: "warning" }] })), /findings remain/);
});

test("CodeQL gate rejects incomplete extraction even with zero findings", () => {
    assert.throws(() => inspectCodeqlReport(report({ invocations: [{
        executionSuccessful: true,
        toolExecutionNotifications: [{ level: "error", message: { text: "undefined: syscall.Kill" } }]
    }] })), /extraction or analysis errors/);
    assert.throws(() => inspectCodeqlReport(report({ invocations: [{ executionSuccessful: false }] })), /analysis errors/);
    assert.throws(() => inspectCodeqlReport(report({ invocations: [] })), /Missing CodeQL invocation/);
    assert.throws(() => inspectCodeqlReport({ version: "2.1.0", runs: [] }), /Missing/);
    assert.throws(() => inspectCodeqlReport(report({ tool: { driver: { name: "CodeQL", rules: [] } } })), /No CodeQL queries/);
});

test("CodeQL gate fails when analysis produced no SARIF artifact", t => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-codeql-"));
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
    assert.throws(() => checkDirectory(temporary), /No SARIF/);
    fs.writeFileSync(path.join(temporary, "empty.sarif"), JSON.stringify({ version: "2.1.0", runs: [] }));
    assert.throws(() => checkDirectory(temporary), /Missing/);
});
