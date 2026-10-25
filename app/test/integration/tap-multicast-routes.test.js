"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("Windows route helper restores only its unchanged TAP metric and preserves the original mutable CIM value", {
    skip: process.platform !== "win32" ? "requires Windows PowerShell; cmdlets are fakes and never change real routes" : false
}, t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-multicast-route-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const source = fs.readFileSync(path.resolve(__dirname, "../../clash_core/win_x64/static/files/win/common/tun2socks/multicast_route.ps1"), "utf8");
    const script = path.join(directory, "route.ps1"), log = path.join(directory, "writes.json");
    const mocks = `
function Get-NetRoute {
    param($AddressFamily,$InterfaceAlias,$DestinationPrefix,$PolicyStore,$InterfaceIndex)
    if ($InterfaceAlias -ne 'cfw-tap' -or $DestinationPrefix -ne '224.0.0.0/4' -or $PolicyStore -ne 'ActiveStore') { throw 'Unexpected route scope' }
    if ($env:CFW_ROUTE_MISSING -ne '1') { [pscustomobject]@{ InterfaceIndex=19; NextHop='0.0.0.0'; RouteMetric=[int]$env:CFW_ROUTE_METRIC } }
}
function Set-NetRoute {
    [CmdletBinding(SupportsShouldProcess=$true)]
    param([Parameter(ValueFromPipeline=$true)]$InputObject,[int]$RouteMetric)
    process {
        $InputObject.RouteMetric=$RouteMetric
        $InputObject | ConvertTo-Json -Compress | Set-Content -LiteralPath $env:CFW_ROUTE_TEST_LOG
    }
}
`;
    fs.writeFileSync(script, source.replace("$ErrorActionPreference = 'Stop'", "$ErrorActionPreference = 'Stop'\n" + mocks));
    function run(action, metric, missing = false) {
        if (fs.existsSync(log)) fs.unlinkSync(log);
        const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script,
            "-Action", action, "-InterfaceIndex", "19", "-OriginalMetric", "256", "-AppliedMetric", "4096"], {
            encoding: "utf8", windowsHide: true, timeout: 10000,
            env: { ...process.env, CFW_ROUTE_TEST_LOG: log, CFW_ROUTE_METRIC: String(metric), CFW_ROUTE_MISSING: missing ? "1" : "0" }
        });
        assert.equal(result.status, 0, result.stderr);
        return { result, written: fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, "utf8").replace(/^\uFEFF/, "")) : null };
    }
    const acquired = run("Acquire", 256);
    assert.equal(JSON.parse(acquired.result.stdout.trim()).originalMetric, 256);
    assert.equal(acquired.written.RouteMetric, 4096);
    assert.equal(run("Release", 4096).written.RouteMetric, 256);
    assert.equal(run("Release", 777).written, null, "preserve a later user edit");
    assert.equal(run("Release", 4096, true).written, null, "missing adapter is harmless");
    assert.equal(run("Acquire", 6000).written, null, "do not lower an existing user multicast metric");
});
