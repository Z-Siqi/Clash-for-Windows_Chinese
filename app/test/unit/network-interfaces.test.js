"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const {
    detectDefaultInterface,
    listNetworkInterfaces
} = require("../../main/dist/electron/features/network/network-interfaces");
const {
    listWlanInterfaces
} = require("../../main/dist/electron/features/network/wlan-interfaces");
const {
    createMacSystemProxyCommand
} = require("../../main/dist/electron/features/network/mac-system-proxy-command");

test("network interface listing excludes internal and IPv6 addresses", () => {
    const result = listNetworkInterfaces({
        networkInterfaces: () => ({
            Ethernet: [
                { internal: false, family: "IPv4", address: "192.0.2.10" },
                { internal: false, family: "IPv6", address: "2001:db8::1" }
            ],
            Loopback: [{ internal: true, family: "IPv4", address: "127.0.0.1" }]
        })
    });
    assert.deepEqual(result, [{ name: "Ethernet", address: "192.0.2.10" }]);
});

test("Windows default interface follows the lowest-metric route and ignores cfw-tap", () => {
    const result = detectDefaultInterface({
        platform: "win32",
        execSync: () => Buffer.from([
            "0.0.0.0 0.0.0.0 192.0.2.1 192.0.2.20 50",
            "0.0.0.0 0.0.0.0 198.51.100.1 198.51.100.20 10"
        ].join("\n")),
        networkInterfaces: () => ({
            "cfw-tap": [{ address: "198.51.100.20" }],
            Ethernet: [{ address: "192.0.2.20" }]
        }),
        isIP: net.isIP,
        isIPv4: net.isIPv4
    });
    assert.equal(result, "Ethernet");
});

test("WLAN parsing separates repeated interface records", () => {
    const result = listWlanInterfaces({
        platform: "win32",
        execSync: () => Buffer.from("Name : Wi-Fi\nSSID : first\nName : Wi-Fi 2\nSSID : second\n")
    });
    assert.deepEqual(result, [
        { Name: "Wi-Fi", SSID: "first" },
        { Name: "Wi-Fi 2", SSID: "second" }
    ]);
});

test("macOS proxy command resolves the selected architecture and normalizes failures", async () => {
    const calls = [];
    const run = createMacSystemProxyCommand({
        platform: "darwin",
        arch: "arm64",
        path: require("node:path"),
        serviceApi: {
            async systemProxy(binary, args) {
                calls.push([binary, args]);
                return { status: 200, data: "ok" };
            }
        },
        isDevelopmentMode: () => false,
        getFilesPath: () => "/files"
    });
    assert.deepEqual(await run(["-show"]), { success: true, output: "ok" });
    assert.match(calls[0][0].replace(/\\/g, "/"), /\/files\/darwin\/arm64\/sysproxy$/);

    const unsupported = createMacSystemProxyCommand({
        platform: "linux",
        arch: "x64",
        path: require("node:path"),
        serviceApi: {},
        isDevelopmentMode: () => false,
        getFilesPath: () => "/files"
    });
    assert.equal(await unsupported([]), false);
});
