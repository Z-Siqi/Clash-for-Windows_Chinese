"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "../..");
const applicationRoot = path.join(repositoryRoot, "app");
const supportedTargets = new Set(["mac-x64", "mac-arm64"]);

function run(command, args, label) {
    const result = spawnSync(command, args, { cwd: repositoryRoot, stdio: "inherit" });
    if (result.status !== 0) throw new Error(`${label} failed`);
}

function runCapture(command, args, label) {
    const result = spawnSync(command, args, {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"]
    });
    if (result.status !== 0) throw new Error(`${label} failed`);
    return result.stdout;
}

function main() {
    const target = process.argv[2];
    if (!supportedTargets.has(target)) {
        throw new Error(`Expected one target: ${[...supportedTargets].join(", ")}`);
    }
    if (process.platform !== "darwin") throw new Error(`${target} DMGs must be created on a darwin host`);

    run(process.execPath, [path.join(__dirname, "package-application.js"), target], "Application packaging");
    const targetRoot = path.join(applicationRoot, "build", "packages", target);
    const latest = JSON.parse(fs.readFileSync(path.join(targetRoot, "latest.json"), "utf8"));
    const packagePath = path.resolve(applicationRoot, latest.outputPath);
    const appNames = fs.readdirSync(packagePath).filter(name => name.endsWith(".app"));
    if (appNames.length !== 1) throw new Error(`Expected one app bundle in ${packagePath}`);

    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-dmg-"));
    const stagingRoot = path.join(temporaryRoot, "staging");
    const mountRoot = path.join(temporaryRoot, "mounted");
    const writableImage = path.join(temporaryRoot, "writable.dmg");
    let mountedDevice = null;
    try {
        fs.mkdirSync(stagingRoot);
        fs.mkdirSync(mountRoot);
        const appName = appNames[0];
        const volumeIcon = path.join(stagingRoot, ".VolumeIcon.icns");
        fs.cpSync(path.join(packagePath, appName), path.join(stagingRoot, appName), {
            recursive: true,
            preserveTimestamps: true
        });
        fs.symlinkSync("/Applications", path.join(stagingRoot, "Applications"));
        fs.copyFileSync(path.join(applicationRoot, "icon.icns"), volumeIcon);
        run("SetFile", ["-a", "V", volumeIcon], "DMG volume icon hiding");
        const version = require(path.join(applicationRoot, "main", "package.json")).version;
        const suffix = target === "mac-arm64" ? "-arm64" : "";
        const artifactName = `Clash.for.Windows-${version}${suffix}.dmg`;
        const artifactPath = path.join(path.dirname(packagePath), artifactName);
        run("hdiutil", [
            "create", "-volname", "Clash for Windows", "-fs", "HFS+",
            "-srcfolder", stagingRoot, "-format", "UDRW", writableImage
        ], "Writable DMG creation");
        const attachOutput = runCapture("hdiutil", [
            "attach", "-readwrite", "-noverify", "-noautoopen", "-mountpoint", mountRoot, writableImage
        ], "Writable DMG mounting");
        const deviceMatch = attachOutput.match(/^(\/dev\/disk\S+)/m);
        if (!deviceMatch) throw new Error("Could not determine the mounted DMG device");
        mountedDevice = deviceMatch[1];

        // Finder only uses .VolumeIcon.icns when the volume root has its custom-icon bit set.
        run("SetFile", ["-a", "V", path.join(mountRoot, ".VolumeIcon.icns")], "DMG volume icon hiding");
        run("SetFile", ["-a", "C", mountRoot], "DMG volume icon assignment");
        run("hdiutil", ["detach", mountedDevice], "Writable DMG unmounting");
        mountedDevice = null;
        run("hdiutil", [
            "convert", writableImage, "-format", "UDZO", "-imagekey", "zlib-level=9", "-o", artifactPath
        ], "Compressed DMG creation");
        if (process.env.CFW_CODESIGN_IDENTITY) {
            run("codesign", [
                "--force", "--timestamp", "--sign", process.env.CFW_CODESIGN_IDENTITY, artifactPath
            ], "DMG signing");
        }
        const metadata = {
            target,
            createdAt: new Date().toISOString(),
            appPath: path.relative(applicationRoot, path.join(packagePath, appName)).replace(/\\/g, "/"),
            dmgPath: path.relative(applicationRoot, artifactPath).replace(/\\/g, "/")
        };
        fs.writeFileSync(path.join(targetRoot, "latest-dmg.json"), `${JSON.stringify(metadata, null, 2)}\n`);
        console.log(`Created ${target} DMG: ${artifactPath}`);
    } finally {
        if (mountedDevice) {
            spawnSync("hdiutil", ["detach", mountedDevice], { cwd: repositoryRoot, stdio: "ignore" });
        }
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

try {
    main();
} catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
}
