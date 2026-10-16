"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { config: releaseConfig } = require("../../app/main/dist/electron/core/release/release-info");
const { synchronizeRelease } = require("./sync-release");

const repositoryRoot = path.resolve(__dirname, "../..");
const applicationRoot = path.join(repositoryRoot, "app");
const sourceRoot = path.join(applicationRoot, "main");
const buildRoot = path.resolve(process.env.CFW_BUILD_ROOT || path.join(applicationRoot, "build"));
const monacoRoot = path.join(buildRoot, "generated", "monaco");
const rendererRoot = path.join(buildRoot, "generated", "renderer");
const linuxDesktopId = releaseConfig.applicationId;

const targets = Object.freeze({
    "win-x64": {
        platform: "win32",
        arch: "x64",
        productName: "Clash for Windows",
        staticRoot: "win_x64"
    },
    "win-arm64": {
        platform: "win32",
        arch: "arm64",
        productName: "Clash for Windows",
        staticRoot: "win32-arm64"
    },
    "linux-x64": {
        platform: "linux",
        arch: "x64",
        productName: "cfw",
        desktopId: linuxDesktopId,
        staticRoot: "linux-x64",
        requiredFiles: ["files/linux/x64/service/core-hashes.json"],
        executableFiles: [
            "files/linux/x64/clash-linux",
            "files/linux/x64/mihomo-linux-amd64",
            "files/linux/x64/service/clash-core-service"
        ]
    },
    "linux-arm64": {
        platform: "linux",
        arch: "arm64",
        productName: "cfw",
        desktopId: linuxDesktopId,
        staticRoot: "linux-arm64",
        requiredFiles: ["files/linux/arm64/service/core-hashes.json"],
        executableFiles: [
            "files/linux/arm64/clash-linux",
            "files/linux/arm64/mihomo-linux-arm64",
            "files/linux/arm64/service/clash-core-service"
        ]
    },
    "mac-x64": {
        platform: "darwin",
        hostPlatform: "darwin",
        arch: "x64",
        productName: "Clash for Windows",
        staticRoot: "darwin-x64",
        requiredFiles: ["files/default/Country.mmdb", "files/darwin/x64/service/core-hashes.json"],
        executableFiles: [
            "files/darwin/x64/clash-darwin",
            "files/darwin/x64/mihomo-darwin-amd64",
            "files/darwin/x64/sysproxy",
            "files/darwin/x64/service/clash-core-service"
        ]
    },
    "mac-arm64": {
        platform: "darwin",
        hostPlatform: "darwin",
        arch: "arm64",
        productName: "Clash for Windows",
        staticRoot: "darwin-arm64",
        requiredFiles: ["files/default/Country.mmdb", "files/darwin/arm64/service/core-hashes.json"],
        executableFiles: [
            "files/darwin/arm64/clash-darwin",
            "files/darwin/arm64/mihomo-darwin-arm64",
            "files/darwin/arm64/sysproxy",
            "files/darwin/arm64/service/clash-core-service"
        ]
    }
});

function fail(message) {
    console.error(message);
    process.exitCode = 1;
}

function requireDirectory(directory, label) {
    if (!fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
        throw new Error(`${label} directory does not exist: ${directory}`);
    }
}

function requireFiles(directory, relativeFiles, label) {
    const missing = relativeFiles.filter(relative => !fs.statSync(path.join(directory, relative), {
        throwIfNoEntry: false
    })?.isFile());
    if (missing.length > 0) {
        throw new Error(`${label} is incomplete; missing:\n${missing.map(file => `- ${file}`).join("\n")}`);
    }
}

function createBuildId(now = new Date()) {
    const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    return `${timestamp}-${process.pid}`;
}

function buildMonaco() {
    const result = spawnSync(process.execPath, [path.join(__dirname, "build-monaco.js")], {
        cwd: repositoryRoot,
        stdio: "inherit",
        windowsHide: true
    });
    if (result.status !== 0) throw new Error("Failed to build Monaco assets");
    const renderer = spawnSync(process.execPath, [path.join(__dirname, "build-renderer.js")], {
        cwd: repositoryRoot, stdio: "inherit", windowsHide: true
    });
    if (renderer.status !== 0) throw new Error("Failed to build browser renderer");
}

function resolvePackagedResourcesRoot(outputPath, target) {
    if (target.platform !== "darwin") return path.join(outputPath, "resources");
    const appBundles = fs.readdirSync(outputPath).filter(name => name.endsWith(".app"));
    if (appBundles.length !== 1) {
        throw new Error(`Expected one app bundle, received ${appBundles.length}`);
    }
    return path.join(outputPath, appBundles[0], "Contents", "Resources");
}

function resolveApplicationIcon(target) {
    if (target.platform === "darwin") return path.join(applicationRoot, "icon.icns");
    if (target.platform === "linux") {
        return path.join(sourceRoot, "dist", "electron", "static", "imgs", "icon_512.png");
    }
    return path.join(applicationRoot, "logo.ico");
}

function preparePackagedSource(buildPath, target) {
    const destination = path.join(buildPath, "dist", "electron", "generated", "monaco");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(monacoRoot, destination, { recursive: true });
    fs.cpSync(rendererRoot, path.join(buildPath, "dist", "electron", "generated", "renderer"), { recursive: true });

    if (target.platform !== "linux") return;
    const manifestPath = path.join(buildPath, "package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    // Electron uses this identity to match Wayland/X11 windows to the installed desktop entry.
    manifest.desktopName = `${target.desktopId}.desktop`;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
}

function writeLinuxDesktopInstaller(outputPath, target) {
    if (target.platform !== "linux") return null;
    for (const name of ["launch-cfw.sh", "install-desktop-entry.sh", "uninstall-desktop-entry.sh"]) {
        const template = fs.readFileSync(path.join(applicationRoot, "linux", name), "utf8").replace(/\r\n/g, "\n");
        const destination = path.join(outputPath, name);
        fs.writeFileSync(destination, template.replaceAll("@CFW_DESKTOP_ID@", target.desktopId), { mode: 0o755 });
        fs.chmodSync(destination, 0o755);
    }
    return path.join(outputPath, "install-desktop-entry.sh");
}

async function main() {
    synchronizeRelease();
    const targetName = process.argv[2];
    const target = targets[targetName];
    if (!target) {
        throw new Error(`Expected one target: ${Object.keys(targets).join(", ")}`);
    }
    if (target.hostPlatform && process.platform !== target.hostPlatform) {
        throw new Error(`${targetName} must be packaged on a ${target.hostPlatform} host`);
    }

    const staticRoot = path.join(applicationRoot, "clash_core", target.staticRoot, "static");
    const targetRoot = path.join(buildRoot, "packages", targetName);
    const invocationRoot = path.join(targetRoot, createBuildId());
    const icon = resolveApplicationIcon(target);

    requireDirectory(sourceRoot, "Application source");
    requireDirectory(staticRoot, "Target static assets");
    requireFiles(applicationRoot, [path.relative(applicationRoot, icon)], "Application icon");
    requireFiles(staticRoot, [
        ...(target.requiredFiles || []),
        ...(target.executableFiles || [])
    ], "Target static assets");
    buildMonaco();
    requireDirectory(monacoRoot, "Generated Monaco assets");
    fs.mkdirSync(invocationRoot, { recursive: true });

    const { packager } = await import("@electron/packager");
    const packagerOptions = {
        dir: sourceRoot,
        name: target.productName,
        platform: target.platform,
        arch: target.arch,
        electronVersion: releaseConfig.electronVersion,
        download: process.env.CFW_ELECTRON_CACHE ? { cacheRoot: process.env.CFW_ELECTRON_CACHE } : undefined,
        appVersion: releaseConfig.version,
        appBundleId: releaseConfig.applicationId,
        appCategoryType: "public.app-category.utilities",
        out: invocationRoot,
        tmpdir: path.join(buildRoot, "temp"),
        prune: true,
        asar: true,
        overwrite: false,
        afterCopy: [({ buildPath }) => preparePackagedSource(buildPath, target)]
    };
    // Electron Packager cannot embed Linux icons; the BrowserWindow PNG and
    // generated desktop integration below own the Linux dock/application icon.
    if (target.platform !== "linux") packagerOptions.icon = icon;
    if (target.platform === "darwin" && process.env.CFW_CODESIGN_IDENTITY) {
        packagerOptions.osxSign = {
            identity: process.env.CFW_CODESIGN_IDENTITY,
            continueOnError: false
        };
    }
    const outputPaths = await packager(packagerOptions);
    if (outputPaths.length !== 1) {
        throw new Error(`Expected one packaged application, received ${outputPaths.length}`);
    }

    const outputPath = outputPaths[0];
    const packagedStaticRoot = path.join(resolvePackagedResourcesRoot(outputPath, target), "static");
    fs.cpSync(path.join(sourceRoot, "dist", "electron", "static"), packagedStaticRoot, { recursive: true });
    fs.cpSync(staticRoot, packagedStaticRoot, { recursive: true });
    for (const relative of target.executableFiles || []) {
        fs.chmodSync(path.join(packagedStaticRoot, relative), 0o755);
    }
    const desktopInstaller = writeLinuxDesktopInstaller(outputPath, target);
    const latest = {
        target: targetName,
        createdAt: new Date().toISOString(),
        outputPath: path.relative(applicationRoot, outputPath).replace(/\\/g, "/")
    };
    fs.writeFileSync(path.join(targetRoot, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
    console.log(`Packaged ${targetName}: ${outputPath}`);
    if (desktopInstaller) {
        console.log(`Linux desktop integration: sh "${desktopInstaller}"`);
    }
}

if (require.main === module) main().catch(error => fail(error.stack || error.message));

module.exports = {
    resolveApplicationIcon,
    resolvePackagedResourcesRoot,
    writeLinuxDesktopInstaller
};
