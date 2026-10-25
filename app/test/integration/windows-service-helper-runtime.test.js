"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const { test } = require("node:test");
const { createClashServiceApi, SERVICE_BASE_URL } = require("../../main/dist/electron/core/network/clash-service-api");
const { createServiceCredentials, readServiceCredentials } = require("../../main/dist/electron/core/network/service-credentials");
const axios = require("../../main/node_modules/axios");

const root = path.resolve(__dirname, "../../..");
const serviceTokens = new Map();
function prepareHelper(home, port) {
    const service = path.join(home, "service");
    const cores = path.join(service, "cores");
    fs.mkdirSync(cores, { recursive: true });
    const { file, credentials } = createServiceCredentials({ fs, path, crypto: require("node:crypto"), home });
    serviceTokens.set(port, credentials.token);
    fs.copyFileSync(file, path.join(service, "service-config.json"));
    fs.copyFileSync(path.join(root, "app/clash_core/win_x64/static/files/win/common/clash-core-service.ps1"), path.join(service, "clash-core-service.ps1"));
    fs.copyFileSync(path.join(root, "app/clash_core/win_x64/static/files/win/x64/service/core-hashes.json"), path.join(service, "core-hashes.json"));
    for (const name of ["clash-win64.exe", "mihomo-windows-amd64.exe", "wintun.dll"]) fs.copyFileSync(path.join(root, "app/clash_core/win_x64/static/files/win/x64", name), path.join(cores, name));
    return path.join(service, "clash-core-service.ps1");
}

function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            server.close(error => error ? reject(error) : resolve(port));
        });
    });
}

function helperApi(home, port) {
    return createClashServiceApi({ getCredentials: () => readServiceCredentials({ fs, path, home }),
        client: Object.fromEntries(["get", "post"].map(method => [method, (url, ...args) => axios[method](url.replace(SERVICE_BASE_URL, `http://127.0.0.1:${port}`), ...args)])) });
}

function request(port, method, pathname, payload, authorize = false, serviceAuth = true) {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: "127.0.0.1",
            port,
            path: pathname,
            method,
            headers: {
                ...(serviceAuth && serviceTokens.has(port) ? { Authorization: `Bearer ${serviceTokens.get(port)}` } : {}),
                ...(authorize ? { Authorization: "Bearer service-helper-test" } : {}),
                ...(body ? {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body)
                } : {})
            }
        }, response => {
            let data = "";
            response.setEncoding("utf8");
            response.on("data", chunk => { data += chunk; });
            response.on("end", () => resolve({ status: response.statusCode, data }));
        });
        req.on("error", reject);
        req.setTimeout(7000, () => req.destroy(new Error("request timed out")));
        req.end(body);
    });
}

async function waitFor(port, pathname, authorize, child, output) {
    // Cold PowerShell startup on hosted Windows runners can exceed 12 seconds.
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`process exited early\n${output.value}`);
        try {
            const response = await request(port, "GET", pathname, undefined, authorize);
            if (response.status === 200) return response;
        } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`endpoint ${pathname} did not start\n${output.value}`);
}

async function waitForMixedPort(port, expectedPort, child, output) {
    // The controller can answer /version before Clash finishes applying config.yaml.
    const deadline = Date.now() + 30000;
    let lastState = "no response";
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`process exited early\n${output.value}`);
        try {
            const response = await request(port, "GET", "/configs", undefined, true);
            const config = JSON.parse(response.data);
            lastState = `status ${response.status}, mixed-port ${config["mixed-port"]}`;
            if (response.status === 200 && config["mixed-port"] === expectedPort) return config;
        } catch (error) {
            lastState = error.message;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`mixed-port ${expectedPort} did not become active (${lastState})\n${output.value}`);
}

async function waitForUnavailable(port, pathname, authorize) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        try {
            const response = await request(port, "GET", pathname, undefined, authorize);
            if (response.status !== 200) return;
        } catch (_) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`endpoint ${pathname} remained available after stop`);
}

async function stopChild(child) {
    if (child.exitCode !== null) return;
    const exited = new Promise(resolve => child.once("exit", resolve));
    child.kill();
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
    assert.notEqual(child.signalCode, null, "helper process did not stop after termination");
}

test("Windows Service helper starts Clash and shuts down a managed Mihomo", {
    skip: process.platform !== "win32" || process.arch !== "x64"
}, async () => {
    let servicePort = await freePort();
    while (servicePort === 53000) servicePort = await freePort();
    const controllerPort = await freePort();
    const mixedPort = await freePort();
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-service-helper-"));
    // Hosted Windows runners use 8.3 TEMP aliases. Exercise that spelling even
    // on machines whose TEMP uses long names; native cores return long paths.
    const home = execFileSync("cmd.exe", ["/d", "/c", 'for %I in ("%CFW_HELPER_TEST_TEMP%") do @echo %~sI'], {
        env: { ...process.env, CFW_HELPER_TEST_TEMP: temporary }, windowsHide: true, windowsVerbatimArguments: true, encoding: "utf8"
    }).trim();
    assert.equal(fs.realpathSync.native(home), fs.realpathSync.native(temporary));
    const core = path.join(root, "app/clash_core/win_x64/static/files/win/x64/clash-win64.exe");
    const mihomo = path.join(root, "app/clash_core/win_x64/static/files/win/x64/mihomo-windows-amd64.exe");
    const helper = prepareHelper(home, servicePort);
    const serviceApi = helperApi(home, servicePort);
    const manifest = path.join(path.dirname(helper), "core-hashes.json");
    fs.copyFileSync(
        path.join(root, "app/clash_core/win_x64/static/files/default/Country.mmdb"),
        path.join(home, "Country.mmdb")
    );
    fs.writeFileSync(path.join(home, "config.yaml"), [
        `mixed-port: ${mixedPort}`,
        `external-controller: 127.0.0.1:${controllerPort}`,
        "secret: service-helper-test",
        "mode: direct",
        "log-level: info",
        "proxies: []",
        "proxy-groups: []",
        "rules: []",
        ""
    ].join("\n"));

    const output = { value: "" };
    const helperProcess = spawn("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", helper,
        "-Port", String(servicePort),
        "-ManifestPath", manifest
    ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    helperProcess.stdout.on("data", chunk => { output.value += chunk; });
    helperProcess.stderr.on("data", chunk => { output.value += chunk; });

    let stage = "helper ping";
    try {
        await waitFor(servicePort, "/ping", false, helperProcess, output);
        assert.equal((await request(servicePort, "POST", "/stop", undefined, false, false)).status, 403);
        assert.equal((await request(servicePort, "POST", "/start", { core: "cmd.exe" })).status, 403);
        assert.equal((await request(servicePort, "GET", "/stop")).status, 404);
        assert.equal((await request(servicePort, "GET", "/ping")).status, 200);
        stage = "service start";
        assert.equal((await serviceApi.ping()).status, 200);
        const dll = path.join(path.dirname(helper), "cores", "wintun.dll");
        const trustedDll = fs.readFileSync(dll);
        fs.writeFileSync(dll, "modified dependency");
        assert.equal((await request(servicePort, "POST", "/start", { core: path.basename(core), silent: true })).status, 403);
        fs.writeFileSync(dll, trustedDll);
        const start = await serviceApi.start({ path: core, cwd: home, silent: false, redactValues: ["synthetic-controller-value"] });
        assert.equal(start.status, 200, `${start.data}\n${output.value}`);
        assert.deepEqual(await serviceApi.getCoreStatus(), { running: true, core: path.basename(core) });
        assert.equal(fs.realpathSync.native(path.dirname(start.data)), fs.realpathSync.native(path.join(home, "logs")));
        assert.ok(fs.statSync(start.data).isFile());
        stage = "core version";
        const version = await waitFor(controllerPort, "/version", true, helperProcess, output);
        assert.match(version.data, /version/i);
        stage = "core config";
        const config = await waitForMixedPort(controllerPort, mixedPort, helperProcess, output);
        assert.equal(config["mixed-port"], mixedPort);
        stage = "service stop";
        try {
            assert.equal((await serviceApi.stop()).status, 200);
        } catch (error) {
            if (error.code !== "ECONNRESET") throw error;
        }
        await waitForUnavailable(controllerPort, "/version", true);
        assert.deepEqual(await serviceApi.getCoreStatus(), { running: false, core: null });
        assert.ok(fs.statSync(start.data).size > 0, "Service Mode must persist core output, rather than create an empty file");
        assert.ok(!fs.readFileSync(start.data, "utf8").includes(serviceTokens.get(servicePort)), "service credentials must not enter core logs");
        stage = "Mihomo service start";
        const mihomoStart = await request(servicePort, "POST", "/start", {
            core: path.basename(mihomo),
            silent: true
        });
        assert.equal(mihomoStart.status, 200, `${mihomoStart.data}\n${output.value}`);
        stage = "Mihomo version";
        const mihomoVersion = await waitFor(controllerPort, "/version", true, helperProcess, output);
        assert.equal(JSON.parse(mihomoVersion.data).meta, true);
        stage = "helper ping while Mihomo is running";
        for (let attempt = 0; attempt < 10; attempt += 1) {
            assert.equal((await request(servicePort, "GET", "/ping")).status, 200);
        }
        stage = "Mihomo shutdown";
        const helperExited = new Promise(resolve => helperProcess.once("exit", resolve));
        assert.equal((await serviceApi.shutdown()).status, 200);
        await Promise.race([helperExited, new Promise(resolve => setTimeout(resolve, 3000))]);
        assert.equal(helperProcess.exitCode, 0, `helper did not exit after shutdown\n${output.value}`);
        await waitForUnavailable(controllerPort, "/version", true);
    } catch (error) {
        throw new Error(`${stage}: ${error.message}\n${output.value}`, { cause: error });
    } finally {
        try { await request(servicePort, "POST", "/stop"); } catch (_) {}
        await stopChild(helperProcess);
        fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
});

test("Windows helper drains both output streams while idle and redacts values spanning reads", {
    skip: process.platform !== "win32" || process.arch !== "x64"
}, async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-service-output-"));
    let servicePort = await freePort();
    while (servicePort === 53000) servicePort = await freePort();
    const helper = prepareHelper(home, servicePort);
    const core = path.join(path.dirname(helper), "cores", "clash-win64.exe");
    fs.unlinkSync(core);
    const compile = path.join(home, "compile.ps1");
    fs.writeFileSync(compile, `\ufeffAdd-Type -OutputAssembly $env:CFW_TEST_CORE -OutputType ConsoleApplication -TypeDefinition @'
using System;
using System.Threading;
public class OutputFixture {
    public static void Main() {
        Console.OutputEncoding = new System.Text.UTF8Encoding(false);
        string value = Environment.GetEnvironmentVariable("CFW_TEST_LOG_VALUE");
        int half = value.Length / 2;
        Console.Write(value.Substring(0, half)); Console.Out.Flush();
        Thread.Sleep(120);
        Console.WriteLine(value.Substring(half)); Console.Out.Flush();
        Console.Error.WriteLine(value);
        Console.WriteLine("核心日志中文");
        for (int i = 0; i < 20000; i++) {
            Console.WriteLine("fixture-stdout-output");
            Console.Error.WriteLine("fixture-stderr-output");
        }
        Console.WriteLine("fixture-stdout-complete"); Console.Out.Flush();
        Console.Error.WriteLine("fixture-stderr-complete"); Console.Error.Flush();
        while (true) Thread.Sleep(100);
    }
}
'@
`);
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", compile],
        { windowsHide: true, env: { ...process.env, CFW_TEST_CORE: core }, stdio: "pipe" });
    const crypto = require("node:crypto");
    fs.writeFileSync(path.join(path.dirname(helper), "core-hashes.json"), JSON.stringify({ cores: [
        { name: path.basename(core), sha256: crypto.createHash("sha256").update(fs.readFileSync(core)).digest("hex") }
    ] }));
    const value = crypto.randomBytes(80).toString("hex");
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper, "-Port", String(servicePort)],
        { windowsHide: true, stdio: "ignore", env: { ...process.env, CFW_TEST_LOG_VALUE: value } });
    try {
        await waitFor(servicePort, "/ping", false, child, { value: "" });
        const started = await helperApi(home, servicePort).start({ path: core, cwd: home, silent: false, redactValues: [value] });
        assert.equal(started.status, 200);
        const deadline = Date.now() + 10000;
        let log = "";
        do {
            log = fs.readFileSync(started.data, "utf8");
            if (log.includes("fixture-stdout-complete") && log.includes("fixture-stderr-complete")) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        } while (Date.now() < deadline);
        assert.ok(log.includes("fixture-stdout-output") && log.includes("fixture-stderr-output"), "both pipes must be drained while the HTTP listener is idle");
        assert.ok(log.includes("fixture-stdout-complete") && log.includes("fixture-stderr-complete"), "neither output pipe may block the child");
        assert.equal((await request(servicePort, "GET", "/ping")).status, 200);
        assert.equal((await request(servicePort, "POST", "/stop")).status, 200);
        const completeLog = fs.readFileSync(started.data, "utf8");
        assert.ok(completeLog.includes("核心日志中文"), "core output must remain UTF-8");
        assert.ok(!completeLog.includes(value) && completeLog.includes("[REDACTED]"), "split output values must be redacted before persistence");
    } finally {
        try { await request(servicePort, "POST", "/shutdown"); } catch (_) {}
        await stopChild(child);
        serviceTokens.delete(servicePort);
        fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
});

test("Windows Service helper recovers after a client stops sending HTTP headers", {
    skip: process.platform !== "win32" || process.arch !== "x64"
}, async () => {
    let servicePort = await freePort();
    while (servicePort === 53000) servicePort = await freePort();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-service-stalled-"));
    const helper = prepareHelper(home, servicePort);
    const manifest = path.join(path.dirname(helper), "core-hashes.json");
    const output = { value: "" };
    const helperProcess = spawn("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", helper,
        "-Port", String(servicePort),
        "-ManifestPath", manifest
    ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    helperProcess.stdout.on("data", chunk => { output.value += chunk; });
    helperProcess.stderr.on("data", chunk => { output.value += chunk; });

    let stalledClient = null;
    try {
        await waitFor(servicePort, "/ping", false, helperProcess, output);
        stalledClient = net.createConnection({ host: "127.0.0.1", port: servicePort });
        await new Promise((resolve, reject) => {
            stalledClient.once("connect", resolve);
            stalledClient.once("error", reject);
        });
        const recoveryStarted = Date.now();
        assert.equal((await waitFor(servicePort, "/ping", false, helperProcess, output)).status, 200);
        assert.ok(Date.now() - recoveryStarted < 3000, "stalled client blocked the helper too long");
        stalledClient.destroy();
        stalledClient = null;
        const exited = new Promise(resolve => helperProcess.once("exit", resolve));
        assert.equal((await request(servicePort, "POST", "/shutdown")).status, 200);
        await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
        assert.equal(helperProcess.exitCode, 0, `helper did not shut down cleanly\n${output.value}`);
    } finally {
        if (stalledClient) stalledClient.destroy();
        await stopChild(helperProcess);
        serviceTokens.delete(servicePort);
        fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
});
