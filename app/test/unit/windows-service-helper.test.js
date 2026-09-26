"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const variants = [
    {
        root: "app/clash_core/win_x64/static/files/win",
        arch: "x64",
        cores: ["clash-win64.exe", "mihomo-windows-amd64.exe"]
    },
    {
        root: "app/clash_core/win32-ia32/static/files/win",
        arch: "ia32",
        cores: ["clash-win32.exe", "mihomo-windows-386.exe"]
    },
    {
        root: "app/clash_core/win32-arm64/static/files/win",
        arch: "arm64",
        cores: ["clash-win-arm64.exe", "mihomo-windows-arm64.exe"]
    }
];

const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
let canonicalScript = null;
let canonicalTask = null;

for (const variant of variants) {
    const variantRoot = path.join(root, variant.root);
    const script = fs.readFileSync(path.join(variantRoot, "common/clash-core-service.ps1"), "utf8");
    const launcher = fs.readFileSync(path.join(variantRoot, "common/clash-core-service.cmd"), "utf8");
    const task = fs.readFileSync(path.join(variantRoot, "common/schtasks.xml"), "utf8");
    const serviceConfig = fs.readFileSync(path.join(variantRoot, "common/service.yml"), "utf8");
    const manifest = JSON.parse(fs.readFileSync(
        path.join(variantRoot, variant.arch, "service/core-hashes.json"),
        "utf8"
    ));

    if (canonicalScript === null) canonicalScript = script;
    else assert.equal(script, canonicalScript, `${variant.arch} helper drifted from the canonical copy`);
    if (canonicalTask === null) canonicalTask = task;
    else assert.equal(task, canonicalTask, `${variant.arch} scheduled task drifted from the canonical copy`);

    assert.match(script, /Security\.Cryptography\.SHA256/);
    assert.match(script, /Get-FileSha256 \$fullPath/);
    assert.match(script, /Core is not allow-listed/);
    assert.match(script, /\$startInfo\.Arguments = '-d "' \+ \$workingDirectory \+ '"'/);
    assert.match(script, /\$client\.ReceiveTimeout = 1000/);
    assert.match(script, /function Try-WriteHttpResponse/);
    assert.match(script, /\$request\.Path -eq '\/shutdown'/);
    assert.match(script, /if \(\$validateRecoveredProcess\) \{ Resolve-TrustedCore \$candidatePath/);
    assert.match(script, /Managed core did not exit after termination/);
    assert.match(script, /LingerOption\]::new\(\$true, 1\)/);
    assert.equal(script.includes("-like 'mihomo-*'"), false);
    assert.equal(script.includes("'/command'"), false);
    assert.match(serviceConfig, /WindowsPowerShell\\v1\.0\\powershell\.exe/);
    assert.match(serviceConfig, /-WindowStyle Hidden/);
    assert.match(launcher, /-WindowStyle Hidden/);
    assert.match(launcher, /%~dp0clash-core-service\.ps1/);
    assert.match(task, /^<Task version="1\.2"/);
    assert.doesNotMatch(task, /encoding=/i);
    assert.match(task, /<AllowHardTerminate>true<\/AllowHardTerminate>/);
    assert.match(task, /<UserId>S-1-5-18<\/UserId>/);
    assert.match(task, /<Command>C:\\Windows\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe<\/Command>/);
    assert.match(task, /<Arguments>.*clash-core-service\.ps1.*core-hashes\.json.*<\/Arguments>/);

    const entries = new Map(manifest.cores.map(entry => [entry.name, entry.sha256]));
    assert.deepEqual([...entries.keys()].sort(), [...variant.cores].sort());
    for (const core of variant.cores) {
        assert.equal(
            entries.get(core),
            sha256(path.join(variantRoot, variant.arch, core)),
            `${variant.arch}/${core} hash allow-list is stale`
        );
    }
}

console.log("windows service helper smoke: PASS");
