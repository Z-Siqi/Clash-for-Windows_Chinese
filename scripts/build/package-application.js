"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "../..");
const applicationRoot = path.join(repositoryRoot, "app");
const sourceRoot = path.join(applicationRoot, "main");
const buildRoot = path.join(applicationRoot, "build");
const monacoRoot = path.join(buildRoot, "generated", "monaco");
const linuxDesktopId = "com.lbyczf.clashwin";

const targets = Object.freeze({
    "win-x64": {
        platform: "win32",
        arch: "x64",
        productName: "Clash for Windows",
        staticRoot: "win_x64"
    },
    "win-ia32": {
        platform: "win32",
        arch: "ia32",
        productName: "Clash for Windows",
        staticRoot: "win32-ia32"
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

    if (target.platform !== "linux") return;
    const manifestPath = path.join(buildPath, "package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    // Electron uses this identity to match Wayland/X11 windows to the installed desktop entry.
    manifest.desktopName = `${target.desktopId}.desktop`;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
}

function writeLinuxDesktopInstaller(outputPath, target) {
    if (target.platform !== "linux") return null;

    const desktopId = target.desktopId;
    const launcherPath = path.join(outputPath, "launch-cfw.sh");
    const scriptPath = path.join(outputPath, "install-desktop-entry.sh");
    const launcher = `#!/bin/sh
set -eu
app_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$app_dir"
exec "$app_dir/${target.productName}" "$@"
`;
    const script = `#!/bin/sh
set -eu

app_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data_home=\${XDG_DATA_HOME:-"$HOME/.local/share"}
applications_dir="$data_home/applications"
icons_dir="$data_home/icons/hicolor/512x512/apps"
desktop_file="$applications_dir/${desktopId}.desktop"
icon_file="$icons_dir/${desktopId}.png"
executable="$app_dir/${target.productName}"
launcher="$app_dir/launch-cfw.sh"
sandbox="$app_dir/chrome-sandbox"

mkdir -p "$applications_dir" "$icons_dir"
cp "$app_dir/resources/static/imgs/icon_512.png" "$icon_file"
chmod 0755 "$executable" "$launcher"

if [ ! -f "$sandbox" ] || [ -L "$sandbox" ]; then
    printf 'Electron sandbox helper is missing or unsafe: %s\\n' "$sandbox" >&2
    exit 1
fi
sandbox_owner=$(stat -c '%u' "$sandbox")
sandbox_mode=$(stat -c '%a' "$sandbox")
if [ "$sandbox_owner" != '0' ] || [ "$sandbox_mode" != '4755' ]; then
    if ! command -v sudo >/dev/null 2>&1; then
        printf 'sudo is required to configure %s as root:root mode 4755.\\n' "$sandbox" >&2
        exit 1
    fi
    printf 'Configuring the Electron sandbox helper (sudo required)...\\n'
    sudo chown root:root -- "$sandbox"
    sudo chmod 4755 -- "$sandbox"
fi
if [ "$(stat -c '%u:%g:%a' "$sandbox")" != '0:0:4755' ]; then
    printf 'Failed to configure Electron sandbox helper: %s\\n' "$sandbox" >&2
    exit 1
fi

escaped_launcher=$(printf '%s' "$launcher" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/%/%%/g')
escaped_app_dir=$(printf '%s' "$app_dir" | sed 's/\\\\/\\\\\\\\/g')
{
    printf '%s\\n' '[Desktop Entry]'
    printf '%s\\n' 'Type=Application'
    printf '%s\\n' 'Version=1.5'
    printf '%s\\n' 'Name=Clash for Windows'
    printf '%s\\n' 'Comment=Rule-based proxy client'
    printf 'Exec="%s"\\n' "$escaped_launcher"
    printf 'TryExec=%s\\n' "$launcher"
    printf 'Path=%s\\n' "$escaped_app_dir"
    printf '%s\\n' 'Icon=${desktopId}'
    printf '%s\\n' 'StartupWMClass=${desktopId}'
    printf '%s\\n' 'Categories=Network;'
    printf '%s\\n' 'StartupNotify=false'
    printf '%s\\n' 'Terminal=false'
} > "$desktop_file"
chmod 0644 "$desktop_file" "$icon_file"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$applications_dir" >/dev/null 2>&1 || true
fi
printf 'Installed %s\\n' "$desktop_file"
`;
    fs.writeFileSync(launcherPath, launcher, { mode: 0o755 });
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
    fs.chmodSync(launcherPath, 0o755);
    fs.chmodSync(scriptPath, 0o755);
    return scriptPath;
}

async function main() {
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
        electronVersion: "44.4.4",
        appBundleId: "com.lbyczf.clashwin",
        appCategoryType: "public.app-category.utilities",
        out: invocationRoot,
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
