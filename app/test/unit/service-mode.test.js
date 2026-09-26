"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const { SERVICE_STATUS, createServiceModeManager } = require(path.join(
    root,
    "app/main/dist/electron/features/service-mode/service-mode-manager"
));

function fakeFileSystem(existing = []) {
    const files = new Set(existing);
    return {
        existsSync: value => files.has(value),
        mkdirSync: value => files.add(value),
        readFileSync: value => Buffer.from(value),
        readdirSync: () => [],
        lstatSync: () => ({ isDirectory: () => false }),
        unlinkSync: value => files.delete(value),
        rmdirSync: value => files.delete(value)
    };
}

function elevatedRecorder(calls) {
    return (command, options, callback) => {
        calls.push([command, options]);
        callback(null, "ok", "");
    };
}

async function run() {
    const darwinCalls = [];
    const darwinFs = fakeFileSystem([
        "/clash/service",
        "/clash/service/clash-core-service",
        "/files/darwin/x64/service/clash-core-service",
        "/files/darwin/x64/service/core-hashes.json"
    ]);
    const darwin = createServiceModeManager({
        platform: "darwin",
        arch: "x64",
        fs: darwinFs,
        path: path.posix,
        sudoExec: elevatedRecorder(darwinCalls),
        serviceApi: { ping: () => Promise.resolve({ status: 200 }) },
        getFilesPath: () => "/files",
        getClashPath: () => "/clash",
        hashFile: file => file.includes("/files/") ? "new" : "old"
    });
    assert.equal(await darwin.statusService(), SERVICE_STATUS.Active);
    assert.equal(darwin.needUpdate(), true);
    await darwin.installService();
    assert.match(darwinCalls[0][0], /launchctl load -w/);
    assert.match(darwinCalls[0][0], /com\.lbyczf\.cfw\.helper\.plist/);
    assert.match(darwinCalls[0][0], /core-hashes\.json/);
    assert.match(darwinCalls[0][0], /chmod 755/);
    assert.match(darwinCalls[0][0], /chmod 644/);

    const linuxCalls = [];
    const linux = createServiceModeManager({
        platform: "linux",
        arch: "arm64",
        fs: fakeFileSystem(["/clash/service"]),
        path: path.posix,
        sudoExec: elevatedRecorder(linuxCalls),
        serviceApi: { ping: () => Promise.resolve({ status: 503 }) },
        getFilesPath: () => "/files",
        getClashPath: () => "/clash",
        getTempPath: () => Promise.resolve("/tmp"),
        hashFile: () => "same"
    });
    assert.equal(await linux.statusService(), SERVICE_STATUS.Inactive);
    await linux.installService();
    assert.match(linuxCalls[0][0], /systemctl enable clash-core-service/);
    assert.match(linuxCalls[0][0], /linux\/arm64\/service/);
    assert.match(linuxCalls[0][0], /core-hashes\.json/);
    assert.match(linuxCalls[0][0], /chmod 755/);
    assert.match(linuxCalls[0][0], /chown root:root/);

    const linuxInstalledHelper = "/clash/service/clash-core-service";
    const linuxMissingManifest = createServiceModeManager({
        platform: "linux",
        arch: "x64",
        fs: fakeFileSystem([
            "/clash/service",
            linuxInstalledHelper,
            "/files/linux/x64/service/clash-core-service",
            "/files/linux/x64/service/core-hashes.json"
        ]),
        path: path.posix,
        sudoExec: elevatedRecorder([]),
        serviceApi: { ping: () => Promise.resolve({ status: 200 }) },
        getFilesPath: () => "/files",
        getClashPath: () => "/clash",
        hashFile: () => "same"
    });
    assert.equal(linuxMissingManifest.needUpdate(), true);

    const windowsCalls = [];
    const cleanInstallPingTimeouts = [];
    let windowsFilesPath = "";
    let windowsClashPath = "";
    const windows = createServiceModeManager({
        platform: "win32",
        arch: "x64",
        fs: fakeFileSystem([]),
        path: path.win32,
        sudoExec: elevatedRecorder(windowsCalls),
        serviceApi: {
            ping: timeout => {
                cleanInstallPingTimeouts.push(timeout);
                return Promise.resolve({ status: 200 });
            }
        },
        getFilesPath: () => windowsFilesPath,
        getClashPath: () => windowsClashPath,
        hashFile: () => "same",
        programFiles: "C:\\Program Files"
    });
    windowsFilesPath = "C:\\files";
    windowsClashPath = "C:\\clash";
    assert.equal(await windows.statusService(), SERVICE_STATUS.NonExistent);
    assert.deepEqual(cleanInstallPingTimeouts, []);
    await windows.installService(0);
    assert.match(windowsCalls[0][0], /schtasks \/create/);
    assert.match(windowsCalls[0][0], /Clash Core Service/);
    assert.match(windowsCalls[0][0], /C:\\files\\win\\common\\clash-core-service\.ps1/);
    assert.match(windowsCalls[0][0], /C:\\files\\win\\common\\clash-core-service\.cmd/);
    assert.match(windowsCalls[0][0], /C:\\files\\win\\x64\\service\\core-hashes\.json/);
    assert.doesNotMatch(windowsCalls[0][0], /schtasks \/change/);
    assert.match(windowsCalls[0][0], /schtasks \/create.*\/xml .*\/F/);
    assert.match(windowsCalls[0][0], /schtasks \/create.*&& schtasks \/run/);
    assert.doesNotMatch(windowsCalls[0][0], /if (?:not )?exist/i);
    assert.match(windowsCalls[0][0], /del \/F \/Q .* & mkdir .* & copy /);
    assert.deepEqual(cleanInstallPingTimeouts, [250]);

    const installedWindowsService = "C:\\Program Files\\Clash for Windows Service\\clash-core-service.exe";
    const missingSourceWindows = createServiceModeManager({
        platform: "win32",
        arch: "x64",
        fs: fakeFileSystem([installedWindowsService]),
        path: path.win32,
        sudoExec: elevatedRecorder([]),
        serviceApi: { ping: () => Promise.resolve({ status: 200 }) },
        getFilesPath: () => "C:\\files",
        getClashPath: () => "C:\\clash",
        hashFile: () => { throw new Error("missing source must not be hashed"); },
        programFiles: "C:\\Program Files"
    });
    assert.equal(missingSourceWindows.needUpdate(), false);

    const installedWindowsDirectory = "C:\\Program Files\\Clash for Windows Service";
    const oldWindowsService = createServiceModeManager({
        platform: "win32",
        arch: "x64",
        fs: fakeFileSystem([installedWindowsDirectory, installedWindowsService]),
        path: path.win32,
        sudoExec: elevatedRecorder([]),
        serviceApi: { ping: () => Promise.resolve({ status: 200 }) },
        getFilesPath: () => "C:\\files",
        getClashPath: () => "C:\\clash",
        hashFile: () => "same",
        programFiles: "C:\\Program Files"
    });
    assert.equal(oldWindowsService.needUpdate(), true);

    const installedTaskFiles = [
        installedWindowsDirectory,
        "C:\\Program Files\\Clash for Windows Service\\clash-core-service.ps1",
        "C:\\Program Files\\Clash for Windows Service\\core-hashes.json",
        "C:\\Program Files\\Clash for Windows Service\\clash-core-service.cmd",
        "C:\\Program Files\\Clash for Windows Service\\schtasks.xml",
        "C:\\files\\win\\common\\clash-core-service.ps1",
        "C:\\files\\win\\common\\schtasks.xml",
        "C:\\files\\win\\x64\\service\\core-hashes.json"
    ];
    const taskDefinitionUpdate = createServiceModeManager({
        platform: "win32",
        arch: "x64",
        fs: fakeFileSystem(installedTaskFiles),
        path: path.win32,
        sudoExec: elevatedRecorder([]),
        serviceApi: { ping: () => Promise.resolve({ status: 200 }) },
        getFilesPath: () => "C:\\files",
        getClashPath: () => "C:\\clash",
        hashFile: file => file.endsWith("Program Files\\Clash for Windows Service\\schtasks.xml")
            ? "old-task" : file.endsWith("files\\win\\common\\schtasks.xml") ? "new-task" : "same",
        programFiles: "C:\\Program Files"
    });
    assert.equal(taskDefinitionUpdate.needUpdate(), true);

    const partialWindowsCalls = [];
    const partialServiceStops = [];
    const partialWindowsService = createServiceModeManager({
        platform: "win32",
        arch: "x64",
        fs: fakeFileSystem([installedWindowsDirectory]),
        path: path.win32,
        sudoExec: elevatedRecorder(partialWindowsCalls),
        serviceApi: {
            ping: () => Promise.resolve({ status: 200 }),
            shutdown: () => {
                partialServiceStops.push("shutdown");
                return Promise.resolve({ status: 200 });
            },
            stop: () => {
                partialServiceStops.push("stop");
                return Promise.resolve({ status: 200 });
            }
        },
        getFilesPath: () => "C:\\files",
        getClashPath: () => "C:\\clash",
        hashFile: () => "same",
        programFiles: "C:\\Program Files"
    });
    await partialWindowsService.updateService();
    assert.equal(partialWindowsCalls.length, 1);
    assert.match(partialWindowsCalls[0][0], /schtasks \/delete/);
    assert.match(partialWindowsCalls[0][0], /clash-core-service\.cmd/);
    assert.doesNotMatch(partialWindowsCalls[0][0], /rmdir .*Clash for Windows Service/);
    assert.deepEqual(partialServiceStops, ["shutdown"]);

    const uninstallLifecycle = [];
    const scheduledTaskPath = "C:\\Program Files\\Clash for Windows Service\\schtasks.xml";
    const scheduledFs = fakeFileSystem([installedWindowsDirectory, scheduledTaskPath]);
    scheduledFs.lstatSync = value => ({ isDirectory: () => value === installedWindowsDirectory });
    const scheduledWindowsService = createServiceModeManager({
        platform: "win32",
        arch: "x64",
        fs: scheduledFs,
        path: path.win32,
        sudoExec: (command, options, callback) => {
            uninstallLifecycle.push(["elevated", command, options]);
            callback(null, "ok", "");
        },
        serviceApi: {
            shutdown: () => {
                uninstallLifecycle.push(["shutdown"]);
                return Promise.resolve({ status: 200 });
            },
            stop: () => {
                uninstallLifecycle.push(["stop"]);
                return Promise.resolve({ status: 200 });
            }
        },
        getFilesPath: () => "C:\\files",
        getClashPath: () => "C:\\clash",
        hashFile: () => "same",
        programFiles: "C:\\Program Files"
    });
    await scheduledWindowsService.uninstallService();
    assert.deepEqual(uninstallLifecycle.map(call => call[0]), ["shutdown", "elevated"]);
    assert.match(uninstallLifecycle[1][1], /schtasks \/end .* & schtasks \/delete .* &/);
    assert.doesNotMatch(uninstallLifecycle[1][1], /schtasks \/end .*&&.*schtasks \/delete/);
    assert.match(uninstallLifecycle[1][1], /rmdir "C:\\Program Files\\Clash for Windows Service" \/s \/q/);

    let pingAttempts = 0;
    const statusPingTimeouts = [];
    const installedWindowsScript = "C:\\Program Files\\Clash for Windows Service\\clash-core-service.ps1";
    const installedWindowsManifest = "C:\\Program Files\\Clash for Windows Service\\core-hashes.json";
    const installedWindowsLauncher = "C:\\Program Files\\Clash for Windows Service\\clash-core-service.cmd";
    const delayedWindowsService = createServiceModeManager({
        platform: "win32",
        arch: "x64",
        fs: fakeFileSystem([
            installedWindowsScript,
            installedWindowsManifest,
            installedWindowsLauncher
        ]),
        path: path.win32,
        sudoExec: elevatedRecorder([]),
        serviceApi: {
            ping: timeout => {
                pingAttempts += 1;
                statusPingTimeouts.push(timeout);
                return pingAttempts < 3
                    ? Promise.reject(new Error("service is starting"))
                    : Promise.resolve({ status: 200 });
            }
        },
        getFilesPath: () => "C:\\files",
        getClashPath: () => "C:\\clash",
        hashFile: () => "same",
        sleep: () => Promise.resolve(),
        programFiles: "C:\\Program Files"
    });
    assert.equal(await delayedWindowsService.statusService(), SERVICE_STATUS.Active);
    assert.equal(pingAttempts, 3);
    assert.deepEqual(statusPingTimeouts, [400, 400, 400]);

    const rendererSource = readRendererCompositionSource(root);
    assert.match(rendererSource, /features\/service-mode\/service-mode-manager/);
    assert.equal(rendererSource.includes("launchctl load -w"), false);
    assert.equal(rendererSource.includes("systemctl enable clash-core-service"), false);
    assert.equal(rendererSource.includes('schtasks /".concat'), false);
    console.log("service mode smoke: PASS");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
