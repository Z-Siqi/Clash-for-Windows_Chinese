"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const rendererPath = path.join(root, "app/main/dist/electron/renderer.js");
const { createSystemProxyRuntime } = require(path.join(
    root,
    "app/main/dist/electron/features/network/system-proxy-runtime"
));

const calls = [];
const childProcess = {
    spawnSync(command, args, options) {
        calls.push([command, args, options]);
        if (args[0] === "query") return { status: 0, stdout: Buffer.from("5") };
        return { status: 0, stdout: Buffer.from("") };
    }
};
const windows = createSystemProxyRuntime({
    platform: "win32",
    childProcess,
    path,
    filesPath: "C:\\files",
    clashPath: "C:\\clash",
    runMacCommand: () => Promise.resolve({ success: false }),
    parseBypass: () => ({ bypass: ["localhost", "127.0.0.1"] }),
    defaultBypass: ["default"],
    logger: { info() {}, error() {} }
});

async function run() {
    assert.equal(await windows.set({
        enabled: true,
        settings: { bypassText: "bypass", specifyHttpProxyProtocol: true },
        mixedPort: 7890,
        innerServerPort: 3333
    }), true);
    assert.deepEqual(calls.at(-1)[1], [
        "global",
        "http=http://127.0.0.1:7890;https=http://127.0.0.1:7890",
        "localhost;127.0.0.1"
    ]);

    assert.equal(await windows.set({
        enabled: true,
        settings: { systemProxyTypeIndex: 1, staticSystemProxyHost: "localhost" },
        mixedPort: 7890,
        innerServerPort: 3333
    }), true);
    assert.equal(calls.at(-1)[1][0], "pac");
    assert.match(calls.at(-1)[1][1], /^http:\/\/localhost:3333\/pac\?t=\d+$/);
    assert.equal(windows.getStatus(), true);

    const macCommands = [];
    const mac = createSystemProxyRuntime({
        platform: "darwin",
        childProcess,
        path,
        filesPath: "/files",
        clashPath: "/clash",
        runMacCommand: args => {
            macCommands.push(args);
            return Promise.resolve({ success: true });
        },
        parseBypass: () => ({ bypass: [] }),
        logger: { info() {}, error() {} }
    });
    assert.equal(await mac.set({ enabled: true, settings: {}, mixedPort: 7890 }), true);
    assert.deepEqual(macCommands, [
        ["-http", "127.0.0.1:7890", "-https", "127.0.0.1:7890", "-socks", "127.0.0.1:7890"],
        ["-bypass", ""]
    ]);

    const rendererSource = fs.readFileSync(rendererPath).toString("latin1");
    const capabilitySource = fs.readFileSync(path.join(path.dirname(rendererPath), "entry/renderer/capabilities.js"), "utf8");
    assert.match(capabilitySource, /require\("..\/..\/features\/network\/system-proxy-runtime"\)/);
    assert.match(capabilitySource, /runtime\(\)\.set\(\{/);
    assert.equal(rendererSource.includes('E.spawnSync("sysproxy.exe"'), false);
    console.log("system proxy smoke: PASS");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
