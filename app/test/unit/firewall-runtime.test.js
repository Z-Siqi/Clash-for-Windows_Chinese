"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const { createFirewallRuntime } = require(path.join(
    root,
    "app/main/dist/electron/features/network/firewall-runtime"
));

const decode = command => Buffer.from(command.split("-EncodedCommand ")[1], "base64").toString("utf16le");

async function run() {
    const calls = [];
    let installed = false;
    const runtime = createFirewallRuntime({
        isWindows: () => true,
        exec: (command, options, callback) => {
            calls.push({ elevated: false, command, options, script: decode(command) });
            callback(null, installed ? "True" : "False", "");
        },
        sudoExec: (command, options, callback) => {
            const script = decode(command);
            calls.push({ elevated: true, command, options, script });
            if (script.includes("New-NetFirewallRule")) installed = true;
            if (script.includes("Remove-NetFirewallRule") && !script.includes("New-NetFirewallRule")) installed = false;
            callback(null, "", "");
        },
        getBinaryPath: () => "C:\\Program Files\\CFW's build\\mihomo-windows-amd64.exe",
        realpathSync: value => value
    });

    assert.equal(await runtime.status(), false);
    assert.equal(await runtime.add(), true);
    assert.equal(await runtime.remove(), true);
    assert.match(calls[1].command, /-EncodedCommand [A-Za-z0-9+/=]+$/);
    assert.match(calls[1].script, /mihomo-windows-amd64\.exe/);
    assert.match(calls[1].script, /CFW''s build/);
    assert.match(calls[1].script, /New-NetFirewallRule/);
    assert.match(calls[1].script, /-Profile Private,Public -Description/);
    assert.match(calls[1].script, /\$ErrorActionPreference = 'Stop'/);
    assert.equal(/\n\s*-[A-Za-z]/.test(calls[1].script), false);
    assert.equal(calls[1].script.includes('powershell.exe -Command "'), false);

    const renderer = readRendererCompositionSource(root);
    const adminHost = fs.readFileSync(path.join(
        root,
        "app/main/dist/electron/entry/main/register-native-admin-ipc.js"
    ), "utf8");
    assert.match(renderer, /createNativeAdminClient/);
    assert.match(adminHost, /require\("\.\.\/\.\.\/features\/network\/firewall-runtime"\)/);
    console.log("firewall runtime smoke: PASS");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
