"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createServiceModeManager } = require("../../main/dist/electron/features/service-mode/service-mode-manager");
const { createServiceCredentials } = require("../../main/dist/electron/core/network/service-credentials");

test("Windows installer copies the complete authenticated service payload with the real command interpreter", { skip: process.platform !== "win32" }, async t => {
    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cfw-install-")));
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
    const home = path.join(temporary, "profile"), programFiles = path.join(temporary, "Program Files");
    fs.mkdirSync(home); fs.mkdirSync(programFiles);
    const installed = path.join(programFiles, "Clash for Windows Service");
    const files = path.resolve(__dirname, "../../clash_core/win_x64/static/files");
    const credentials = createServiceCredentials({ fs, path, crypto, home });
    let copied = false;
    const manager = createServiceModeManager({
        fs, path, platform: "win32", arch: "x64", programFiles,
        getFilesPath: () => files, getClashPath: () => home,
        prepareCredentials: () => credentials,
        serviceApi: { ping: async () => { assert.ok(copied); return { status: 200 }; } },
        sudoExec(command, _options, callback) {
            try {
                // Scheduling and ACL policy have separate checks; this test must
                // never register a real system task or alter host permissions.
                assert.ok(command.includes("&& schtasks /create"));
                const copyCommand = command.split("&& schtasks /create")[0].replace(/icacls "[^"]+" \/inheritance:r \/grant:r [^&]+&& /, "ver >nul && ");
                const batch = path.join(temporary, "install.cmd");
                fs.writeFileSync(batch, `@echo off\r\n${copyCommand}\r\n`);
                execFileSync("cmd.exe", ["/d", "/c", batch], { windowsHide: true, stdio: "pipe" });
                const policy = JSON.parse(fs.readFileSync(path.join(installed, "service-config.json")));
                assert.ok(policy.token === credentials.credentials.token);
                assert.equal(policy.dataDirectory, home);
                const manifest = JSON.parse(fs.readFileSync(path.join(installed, "core-hashes.json")));
                for (const core of manifest.cores) {
                    const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(installed, "cores", core.name))).digest("hex");
                    assert.equal(digest, core.sha256.toLowerCase());
                }
                for (const file of ["clash-core-service.cmd", "clash-core-service.ps1", "schtasks.xml"]) assert.ok(fs.statSync(path.join(installed, file)).size > 0);
                copied = true; callback(null, "", "");
            } catch (error) { callback(error); }
        }
    });
    await manager.installService();
    assert.ok(copied);
});
