"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const rendererPath = path.join(root, "app/main/dist/electron/renderer.js");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const { buildTunConfig } = require(path.join(
    root,
    "app/main/dist/electron/features/tun/build-tun-config"
));
const { createTunRuntime } = require(path.join(
    root,
    "app/main/dist/electron/features/tun/tun-runtime"
));

const windowsConfig = buildTunConfig({ dnsHijacks: ["any:53"] }, "win32");
assert.equal(windowsConfig.tun.enable, true);
assert.equal(windowsConfig.tun.stack, "gvisor");
assert.equal(windowsConfig.tun["auto-detect-interface"], true);
assert.deepEqual(windowsConfig.tun["dns-hijack"], ["any:53"]);
assert.equal(windowsConfig.dns["fake-ip-filter"].includes("*.msftncsi.com"), true);
assert.equal("default-nameserver" in windowsConfig.dns, false);

const nullSettingsConfig = buildTunConfig(null, "win32");
assert.equal(nullSettingsConfig.tun.enable, true);
assert.equal(nullSettingsConfig.dns.ipv6, false);

const linuxConfig = buildTunConfig({
    stackType: 1,
    isAutoDetectInterface: false,
    interfaceName: "eth0",
    isAutoRedir: true,
    isAutoRedirAutoRoute: false,
    defaultNameservers: ["1.1.1.1"]
}, "linux");
assert.equal(linuxConfig.tun.stack, "system");
assert.equal(linuxConfig["interface-name"], "eth0");
assert.deepEqual(linuxConfig["auto-redir"], { enable: true, "auto-route": false });
assert.deepEqual(linuxConfig.dns["default-nameserver"], ["1.1.1.1"]);

const commands = [];
const spawned = { pid: 42 };
const childProcess = {
    execSync(command) {
        commands.push(["execSync", command]);
        if (command === "net session") throw new Error("not elevated");
        if (command.startsWith("route print")) {
            return Buffer.from("10.0.0.0  255.255.255.0  10.0.0.1");
        }
        return Buffer.from("");
    },
    exec(command, options, callback) {
        commands.push(["exec", command, options]);
        callback(null);
    },
    spawn(command, args, options) {
        commands.push(["spawn", command, args, options]);
        return spawned;
    }
};
const runtime = createTunRuntime({
    childProcess,
    sudoExec(command, options, callback) {
        commands.push(["sudo", command, options]);
        callback(undefined);
    },
    path,
    platform: "win32",
    arch: "x64",
    filesPath: "C:\\files",
    tapInfo: { ip: "10.0.0.1", subnet: "255.255.255.0", gateway: "10.0.0.0" },
    logger: { info: message => commands.push(["log", message]) },
    sleep: () => Promise.resolve()
});

const nullTapInfoRuntime = createTunRuntime({
    childProcess,
    sudoExec(command, options, callback) {
        commands.push(["sudo", command, options]);
        callback(undefined);
    },
    path,
    platform: "win32",
    arch: "x64",
    filesPath: "C:\\files",
    tapInfo: null
});

async function run() {
    assert.equal(await nullTapInfoRuntime.setupTapDevice(true), true);
    assert.equal(commands.some(call => call[0] === "sudo"
        && call[1].endsWith("amd64 10.0.0.1 255.255.255.0 10.0.0.0")), true);

    assert.equal(await runtime.setupTapDevice(true), true);
    assert.equal(commands.some(call => call[0] === "sudo" && call[1].includes("add_tap_device.bat")), true);

    const result = await runtime.spawnTun2socks({ currentProcess: null, mixedPort: 7890 });
    assert.equal(result, spawned);
    const spawn = commands.find(call => call[0] === "spawn");
    assert.equal(spawn[1], "go-tun2socks.exe");
    assert.equal(spawn[2].includes("127.0.0.1:7890"), true);
    assert.equal(commands.some(call => call[1] && call[1].startsWith("route add")), true);

    runtime.killSpawned(spawned);
    assert.equal(commands.some(call => call[1] === "taskkill /F /PID 42"), true);
    await runtime.setRoutes();
    assert.equal(commands.some(call => call[0] === "sudo" && call[1].includes("set_routes.bat")), true);

const rendererSource = readRendererCompositionSource(root);
const homePageOptionsSource = fs.readFileSync(path.join(
    root, "app/main/dist/electron/features/home/page-options.js"
), "utf8");
assert.equal(/case 67:\s*const Lg = new Language/.test(rendererSource), false);
assert.match(homePageOptionsSource, /return refreshRendererProfile\(this, \{/);
assert.match(rendererSource, /require\("\.\/refresh-profile"\)/);
    assert.match(rendererSource, /features\/tun\/build-tun-config/);
    assert.match(rendererSource, /features\/tun\/tun-runtime/);
    assert.match(homePageOptionsSource, /this\.createTunRuntime\(\)\.spawnTun2socks/);
    assert.match(homePageOptionsSource, /const previousProcess = this\.tun2socks;\s+this\.tun2socks = null;/);
    assert.match(homePageOptionsSource, /currentProcess: previousProcess/);
    assert.equal(rendererSource.includes('J().spawn("go-tun2socks.exe"'), false);
    assert.equal(rendererSource.includes('"fake-ip-filter"] = void 0 === h'), false);
    console.log("TUN/network smoke: PASS");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
