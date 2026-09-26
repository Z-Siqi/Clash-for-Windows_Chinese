"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const { createClashCoreRuntime } = require(path.join(
    root,
    "app/main/dist/electron/features/clash-core/clash-core-runtime"
));

const calls = [];
const stdoutListeners = new Map();
const stderrListeners = new Map();
const processHandle = {
    pid: 123,
    stdout: {
        on: (event, listener) => stdoutListeners.set(event, listener),
        pipe: stream => calls.push(["stdout-pipe", stream])
    },
    stderr: {
        on: (event, listener) => stderrListeners.set(event, listener),
        pipe: stream => calls.push(["stderr-pipe", stream])
    },
    on: (event, listener) => calls.push(["process-on", event, listener])
};
const childProcess = {
    spawn(command, args, options) {
        calls.push(["spawn", command, args, options]);
        return processHandle;
    },
    execSync(command, options) {
        calls.push(["execSync", command, options]);
    }
};
const fakeFs = {
    readdir(directory, callback) {
        calls.push(["readdir", directory]);
        callback(null, ["2000-01-01-000000.log", "keep.txt"]);
    },
    unlink(file, callback) {
        calls.push(["unlink", file]);
        callback();
    },
    createWriteStream(file, options) {
        const stream = { file, options };
        calls.push(["stream", file, options]);
        return stream;
    }
};
const serviceApi = {
    stop() {
        calls.push(["service-stop"]);
        return Promise.resolve({ status: 200 });
    },
    start(body) {
        calls.push(["service-start", body]);
        return Promise.resolve({ status: 200, data: "service.log" });
    }
};
const runtime = createClashCoreRuntime({
    childProcess,
    fs: fakeFs,
    // This suite exercises Windows paths even when the host runner is Linux.
    path: path.win32,
    serviceApi,
    sleep: () => Promise.resolve(),
    logger: {
        info: message => calls.push(["info", message]),
        error: message => calls.push(["error", message])
    }
});

async function run() {
    const status = await runtime.getStatus({
        getConfig: options => {
            calls.push(["config", options]);
            return Promise.resolve({ status: 200, data: { "mixed-port": 7890 } });
        }
    });
    assert.deepEqual(status, { connected: true, mixedPort: 7890 });
    const unavailablePort = await runtime.getStatus({
        getConfig: () => Promise.resolve({ status: 200, data: { "mixed-port": 0 } })
    });
    assert.deepEqual(unavailablePort, { connected: true, mixedPort: 0 });

    const logFiles = [];
    const local = await runtime.start({
        clashPath: "C:\\clash",
        binaryPath: "C:\\files\\clash.exe",
        coreType: "clash",
        logLevel: "info",
        isLocalMode: true,
        portableMode: false,
        devMode: false,
        lightweightMode: false,
        clashApi: { getConfig: () => Promise.resolve({ status: 200, data: { "mixed-port": 7890 } }) },
        startupErrorMessage: "failed",
        onLogFile: file => logFiles.push(file),
        onCoreReady: () => calls.push(["ready"]),
        onServiceFallback: () => calls.push(["fallback"])
    });
    assert.equal(local.processHandle, processHandle);
    assert.deepEqual(calls.find(call => call[0] === "spawn").slice(1, 3), [
        "C:\\files\\clash.exe", ["-d", "C:\\clash"]
    ]);
    assert.equal(logFiles.length, 1);
    await stdoutListeners.get("data")(Buffer.from("INF [API] listening addr=127.0.0.1"));
    assert.equal(calls.some(call => call[0] === "ready"), true);
    await stdoutListeners.get("data")(Buffer.from('time="now" level=info msg="[API] listening addr=127.0.0.1:9090"'));
    assert.equal(calls.filter(call => call[0] === "ready").length, 1);

    await runtime.start({
        clashPath: "C:\\clash",
        binaryPath: "C:\\files\\mihomo-windows-amd64.exe",
        coreType: "mihomo",
        logLevel: "silent",
        isLocalMode: true,
        portableMode: false,
        devMode: false,
        lightweightMode: false,
        clashApi: { getConfig: () => Promise.resolve({ status: 503 }) },
        startupErrorMessage: "failed",
        onLogFile() {},
        onCoreReady: () => calls.push(["mihomo-ready"]),
        onServiceFallback() {}
    });
    const mihomoSpawn = calls.filter(call => call[0] === "spawn").at(-1);
    assert.deepEqual(mihomoSpawn.slice(1, 3), [
        "C:\\files\\mihomo-windows-amd64.exe", ["-d", "C:\\clash"]
    ]);
    assert.deepEqual(mihomoSpawn[3], {
        cwd: "C:\\files",
        windowsHide: true,
        shell: false,
        detached: false,
        stdio: ["ignore", "pipe", "pipe"]
    });
    await stderrListeners.get("data")(
        Buffer.from('time="now" level=info msg="RESTful API listening at: 127.0.0.1:9090"')
    );
    assert.equal(calls.some(call => call[0] === "mihomo-ready"), true);

    await runtime.stop({ processHandle, lightweightMode: false, platform: "win32" });
    assert.equal(calls.some(call => call[1] === "taskkill /F /PID 123"), true);
    assert.equal(calls.some(call => call[0] === "service-stop"), true);

    const serviceLogs = [];
    const service = await runtime.start({
        clashPath: "C:\\clash",
        binaryPath: "clash.exe",
        coreType: "clash",
        logLevel: "silent",
        isLocalMode: false,
        portableMode: false,
        devMode: false,
        lightweightMode: false,
        clashApi: { getConfig: () => Promise.resolve({ status: 200, data: { "mixed-port": 7890 } }) },
        startupErrorMessage: "failed",
        onLogFile: file => serviceLogs.push(file),
        onCoreReady() {},
        onServiceFallback() {}
    });
    assert.equal(service.serviceMode, true);
    assert.deepEqual(serviceLogs, ["service.log"]);

    let timeoutProbeCount = 0;
    const timedOutRuntime = createClashCoreRuntime({
        childProcess,
        fs: fakeFs,
        path: path.win32,
        serviceApi: {
            start: () => Promise.reject(new Error("request timed out")),
            stop: serviceApi.stop
        },
        sleep: () => Promise.resolve(),
        logger: { info() {}, error() {} }
    });
    const recoveredAfterTimeout = await timedOutRuntime.start({
        clashPath: "C:\\clash",
        binaryPath: "mihomo-windows-amd64.exe",
        coreType: "mihomo",
        logLevel: "silent",
        isLocalMode: false,
        portableMode: false,
        devMode: false,
        lightweightMode: false,
        clashApi: {
            getConfig: () => {
                timeoutProbeCount += 1;
                return Promise.resolve({ status: timeoutProbeCount === 2 ? 200 : 503 });
            }
        },
        startupErrorMessage: "failed",
        onLogFile() {},
        onCoreReady() {},
        onServiceFallback() {
            assert.fail("a reachable service core must not fall back to local mode");
        }
    });
    assert.equal(recoveredAfterTimeout.serviceMode, true);
    assert.equal(timeoutProbeCount, 2);

    const fallbackCalls = [];
    const fallbackTimeouts = [];
    const failedService = await runtime.start({
        clashPath: "C:\\clash",
        binaryPath: "clash.exe",
        coreType: "clash",
        logLevel: "silent",
        isLocalMode: false,
        portableMode: false,
        devMode: false,
        lightweightMode: false,
        clashApi: {
            getConfig: options => {
                fallbackTimeouts.push(options.timeout);
                return Promise.resolve({ status: 503 });
            }
        },
        startupErrorMessage: "failed",
        onLogFile() {},
        onCoreReady() {},
        onServiceFallback: () => fallbackCalls.push("fallback")
    });
    assert.equal(failedService.fallback, true);
    assert.equal(fallbackCalls.length, 1);
    assert.equal(fallbackTimeouts.length, 15);
    assert.deepEqual([...new Set(fallbackTimeouts)], [150]);
    assert.equal(calls.filter(call => call[0] === "service-stop").length >= 2, true);

    const rendererSource = readRendererCompositionSource(root);
    const homePageOptionsSource = fs.readFileSync(path.join(
        root, "app/main/dist/electron/features/home/page-options.js"
    ), "utf8");
    assert.match(rendererSource, /features\/clash-core\/clash-core-runtime/);
    assert.match(homePageOptionsSource, /this\.createClashCoreRuntime\(\)\.start\(\{/);
    assert.match(homePageOptionsSource, /coreType: this\.settings\.proxyCore/);
    assert.match(rendererSource, /createRendererAppModule\(\{/);
    assert.equal(homePageOptionsSource.includes('J().spawn(o, l, {'), false);
    assert.equal(homePageOptionsSource.includes('re().post("http://127.0.0.1:53000/start"'), false);
    console.log("Clash core runtime smoke: PASS");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
