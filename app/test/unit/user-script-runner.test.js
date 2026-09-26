"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const yaml = require("../../main/node_modules/yaml");
const {
    PROFILE_SCRIPT,
    PROXY_SCRIPT,
    createUserScriptRunner
} = require("../../main/dist/electron/features/scripts/user-script-runner");

test("user script runner loads profile and proxy scripts with the established runtime context", async () => {
    const executions = [];
    const store = {
        state: { app: {
            clashPath: "C:/cfw",
            settings: { scriptsText: yaml.stringify({ scripts: {
                profile: { code: "profile-code" },
                proxy: { file: "proxy.js" }
            } }) }
        } },
        dispatch: async action => { assert.equal(action, "getScriptLogPath"); return "script.log"; }
    };
    const fakeFs = {
        createWriteStream: value => ({ value }),
        readFileSync: (file, encoding) => {
            assert.equal(file, "proxy.js");
            assert.equal(encoding, "utf8");
            return "proxy-code";
        }
    };
    const runner = createUserScriptRunner({
        store, axios: { marker: "axios" }, yaml, fs: fakeFs,
        Console: class { constructor(stream) { this.stream = stream; } },
        requireFromString: (source, filename) => ({
            run(payload, context) { executions.push({ source, filename, payload, context }); }
        }),
        notify() {}, showMessageBox() {}, resolveHost() {}
    });
    await runner.run({ mode: "rule" }, PROFILE_SCRIPT);
    await runner.run({ name: "proxy" }, PROXY_SCRIPT);
    assert.equal(executions.length, 2);
    assert.match(executions[0].source, /profile-code/);
    assert.match(executions[1].source, /proxy-code/);
    assert.equal(executions[1].filename, "proxy.js");
    assert.equal(executions[0].context.homeDir, "C:/cfw");
    assert.equal(executions[0].context.console.stream.value, "script.log");
});

test("user script runner ignores malformed settings and unknown script types", async () => {
    let loaded = false;
    const runner = createUserScriptRunner({
        store: {
            state: { app: { clashPath: "C:/cfw", settings: { scriptsText: "scripts: [" } } },
            dispatch: async () => "script.log"
        },
        axios: {}, yaml,
        fs: { createWriteStream: () => ({}), readFileSync() { throw Error("unexpected"); } },
        Console: class {}, requireFromString() { loaded = true; return {}; },
        notify() {}, showMessageBox() {}, resolveHost() {}
    });
    await runner.run({}, Symbol("unknown"));
    assert.equal(loaded, false);
});
