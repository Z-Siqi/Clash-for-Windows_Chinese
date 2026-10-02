"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { runElectronSecuritySmoke } = require("../../../scripts/run-electron-security-smoke");

test("Electron smoke refuses a packaged app before spawning or touching a profile", async () => {
    let spawned = false;
    await assert.rejects(runElectronSecuritySmoke({
        binary: "/missing/packaged-app.exe", spawnProcess() { spawned = true; }
    }), /stock Electron runtime/);
    assert.equal(spawned, false);
});
