"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProfileNetworkEffects } = require("../../main/dist/electron/features/network/profile-network-effects");

test("TAP discovery queries only the fixed adapter and never reports success after a failed lookup", () => {
    const calls = [];
    const effects = createProfileNetworkEffects({ childProcess: {
        execFileSync(command, args) { calls.push([command, args]); return Buffer.from("localized adapter status"); }
    } });
    assert.equal(effects.hasTap(), true);
    assert.deepEqual(calls, [["netsh", ["interface", "show", "interface", "name=cfw-tap"]]]);
    const missing = createProfileNetworkEffects({ childProcess: { execFileSync() { throw Error("adapter missing or query failed"); } } });
    assert.equal(missing.hasTap(), false);
});
