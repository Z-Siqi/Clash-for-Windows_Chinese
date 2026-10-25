"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProfileNetworkEffects } = require("../../main/dist/electron/features/network/profile-network-effects");

const table = names => `Admin State    State          Type             Interface Name\r\n---------------------------------------------------------------------------\r\n${names.map(name => `Enabled        Disconnected   Dedicated        ${name}`).join("\r\n")}\r\n`;

test("TAP discovery distinguishes confirmed absence from an unavailable adapter enumeration", async () => {
    const calls = [];
    const effects = createProfileNetworkEffects({ childProcess: {
        execFile(command, args, _options, callback) { calls.push([command, args]); callback(null, table(["cfw-tap"])); }
    } });
    assert.equal(await effects.hasTap(), true);
    assert.deepEqual(calls, [["netsh", ["interface", "show", "interface"]]]);
    const missing = createProfileNetworkEffects({ childProcess: { execFile(_file, _args, _options, callback) { callback(Error("adapter missing or query failed")); } } });
    assert.equal(await missing.hasTap(), null);
});

test("a complete localized table matches only the exact TAP alias, including disconnected adapters", async () => {
    for (const [names, expected] of [[["cfw-tap"], true], [["CFW-TAP", "another  adapter"], true], [["copy cfw-tap", "cfw-tap-old", "another  adapter"], false], [[], false]]) {
        const effects = createProfileNetworkEffects({ childProcess: { execFile(_file, _args, _options, callback) {
            callback(null, table(names).replace("Admin State", "管理状态").replace("Disconnected", "已断开连接"));
        } } });
        assert.equal(await effects.hasTap(), expected);
    }
});

test("timeouts and malformed responses stay unknown and cannot poison the next TAP lookup", async () => {
    for (const unavailable of [Error("query failed"), Object.assign(Error("timed out"), { killed: true }), "", "unrecognized output", "Header\n---\ninvalid row\n"]) {
        let calls = 0;
        const effects = createProfileNetworkEffects({ childProcess: { execFile(_file, _args, _options, callback) {
            if (++calls === 1) callback(unavailable instanceof Error ? unavailable : null, typeof unavailable === "string" ? unavailable : "");
            else callback(null, table(["cfw-tap"]));
        } } });
        assert.equal(await effects.hasTap(), null);
        assert.equal(await effects.hasTap(), true);
    }
});

test("a single PnP absence cannot replace an installed TAP observation and confirmed removal stays observable", async () => {
    for (const [second, expected] of [[table(["cfw-tap"]), true], [table(["Ethernet"]), false], [Error("timeout during confirmation"), null]]) {
        let calls = 0;
        const delays = [];
        const effects = createProfileNetworkEffects({ sleep: async duration => delays.push(duration), childProcess: { execFile(_file, _args, _options, callback) {
            const value = ++calls === 1 ? table(["Ethernet"]) : second;
            callback(value instanceof Error ? value : null, typeof value === "string" ? value : "");
        } } });
        assert.equal(await effects.hasTap(), expected);
        assert.equal(calls, 2);
        assert.deepEqual(delays, [150]);
    }
});
