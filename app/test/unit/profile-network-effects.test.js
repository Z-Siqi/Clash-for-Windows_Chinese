"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProfileNetworkEffects } = require("../../main/dist/electron/features/network/profile-network-effects");

test("TAP discovery queries only the fixed adapter and never reports success after a failed lookup", async () => {
    const calls = [];
    const effects = createProfileNetworkEffects({ childProcess: {
        execFile(command, args, _options, callback) { calls.push([command, args]); callback(null, "localized adapter status"); }
    } });
    assert.equal(await effects.hasTap(), true);
    assert.deepEqual(calls, [["netsh", ["interface", "show", "interface", "name=cfw-tap"]]]);
    const missing = createProfileNetworkEffects({ childProcess: { execFile(_file, _args, _options, callback) { callback(Error("adapter missing or query failed")); } } });
    assert.equal(await missing.hasTap(), false);
});
