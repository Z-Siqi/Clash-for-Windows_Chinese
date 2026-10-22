"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");

test("Windows TAP supervisor verifies completion independently of worker exit status or deadline", {
    skip: process.platform !== "win32" ? "requires Windows PowerShell and taskkill" : false
}, async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-tap-watchdog-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const source = fs.readFileSync(path.resolve(__dirname, "../../clash_core/win_x64/static/files/win/common/tun2socks/configure_tap_device.ps1"), "utf8");
    const marker = "$deviceName = 'cfw-tap'";
    assert.equal(source.split(marker).length, 2);
    for (const scenario of ["stalled-incomplete", "stalled-complete", "failed-complete", "success-incomplete"]) {
        await t.test(scenario, async () => {
            const script = path.join(directory, "watchdog.ps1");
            // Only the OS state reader and worker's native writes are fakes.
            // The production supervisor runs unchanged, without touching a real adapter.
            fs.writeFileSync(path.join(directory, "tap_device_state.ps1"), `$script:reads = 0\nfunction Get-CfwTapState { $script:reads++; return @{ configured = ${scenario.endsWith("-complete") ? "$script:reads -gt 1" : "$false"} } }\n`);
            fs.writeFileSync(script, source.slice(0, source.indexOf(marker)) + (scenario.startsWith("stalled") ? "Start-Sleep -Seconds 30\nexit 0\n" : `exit ${scenario.startsWith("failed") ? 1 : 0}\n`));
            const started = Date.now();
            const result = await new Promise(resolve => execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script,
                "-IP", "10.0.0.1", "-Subnet", "255.255.255.0", "-Gateway", "10.0.0.0"],
            { windowsHide: true, timeout: 15000 }, (error, stdout, stderr) => resolve({ error, stdout, stderr })));
            const elapsed = Date.now() - started;
            if (scenario.endsWith("-complete")) {
                assert.equal(result.error, null, result.stderr);
                assert.match(result.stdout, /CFW_TAP_CONFIGURED/);
            } else {
                assert.equal(result.error?.code, scenario.startsWith("stalled") ? 10 : 1, result.stderr);
                if (scenario.startsWith("stalled")) assert.match(result.stdout, /CFW_TAP_SETUP_TIMEOUT/);
            }
            if (scenario.startsWith("stalled")) assert.ok(elapsed >= 8000 && elapsed < 14000, `watchdog finished after ${elapsed} ms`);
        });
    }
});
