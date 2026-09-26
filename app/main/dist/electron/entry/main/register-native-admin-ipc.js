"use strict";

const { createClashServiceApi } = require("../../core/network/clash-service-api");
const { createFirewallRuntime } = require("../../features/network/firewall-runtime");
const { createServiceModeManager } = require("../../features/service-mode/service-mode-manager");

function registerNativeAdminIpc({
    ipcMain,
    app,
    getMainWindow,
    fs,
    path,
    crypto,
    childProcess,
    sudoPrompt,
    axios,
    platform = process.platform,
    arch = process.arch,
    resourcesPath = process.resourcesPath
}) {
    const packagedResourcesPath = resourcesPath || path.dirname(app.getPath("exe"));
    const expectedFilesPath = app.isPackaged
        ? path.join(packagedResourcesPath, "static", "files")
        : path.resolve("static", "files");
    const allowedClashPaths = new Set([
        path.resolve(app.getPath("home"), ".config", "clash"),
        path.resolve(app.getPath("exe"), "..", "data")
    ].map(normalizePath));

    ipcMain.handle("native-admin", async function(event, scope, action, payload = {}) {
        const mainWindow = getMainWindow();
        if (!mainWindow || event.sender !== mainWindow.webContents) {
            throw new Error("Native administrator request did not originate from the main window");
        }
        const filesPath = requireExactPath(payload.filesPath, expectedFilesPath, "packaged files");
        const clashPath = requireAllowedClashPath(payload.clashPath);

        if (scope === "firewall") {
            if (!isWindows()) return false;
            const binaryPath = requirePackagedCore(payload.binaryPath, filesPath);
            const firewall = createFirewallRuntime({
                isWindows,
                exec: childProcess.exec,
                sudoExec: sudoPrompt.exec,
                getBinaryPath: () => binaryPath,
                realpathSync: fs.realpathSync
            });
            if (!["status", "add", "remove"].includes(action)) {
                throw new Error("Unsupported firewall administrator action");
            }
            return firewall[action]();
        }

        if (scope === "service") {
            const manager = createServiceModeManager({
                platform,
                arch,
                fs,
                path,
                sudoExec: sudoPrompt.exec,
                serviceApi: createClashServiceApi({ client: axios }),
                getFilesPath: () => filesPath,
                getClashPath: () => clashPath,
                getTempPath: () => app.getPath("temp"),
                hashFile
            });
            if (action === "install") {
                const method = Number(payload.method);
                if (platform === "win32" && ![0, 1].includes(method)) {
                    throw new Error("Unsupported Windows Service Mode install method");
                }
                await manager.installService(platform === "win32" ? method : undefined);
                return true;
            }
            if (action === "uninstall") {
                await manager.uninstallService();
                return true;
            }
            if (action === "update") {
                await manager.updateService();
                return true;
            }
            throw new Error("Unsupported Service Mode administrator action");
        }

        throw new Error("Unsupported native administrator scope");
    });

    function isWindows() {
        return platform === "win32";
    }

    function normalizePath(value) {
        return platform === "win32" ? value.toLowerCase() : value;
    }

    function requireExactPath(candidate, expected, label) {
        if (typeof candidate !== "string" || normalizePath(path.resolve(candidate)) !== normalizePath(path.resolve(expected))) {
            throw new Error(`Invalid ${label} path`);
        }
        return path.resolve(expected);
    }

    function requireAllowedClashPath(candidate) {
        if (typeof candidate !== "string") throw new Error("Invalid CFW data directory");
        const resolved = path.resolve(candidate);
        if (!allowedClashPaths.has(normalizePath(resolved))) {
            throw new Error("CFW data directory is outside the allowed locations");
        }
        return resolved;
    }

    function requirePackagedCore(candidate, filesPath) {
        if (typeof candidate !== "string") throw new Error("Invalid packaged core path");
        const resolved = fs.realpathSync(candidate);
        const relative = path.relative(fs.realpathSync(filesPath), resolved);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
            throw new Error("Core binary is outside the packaged files directory");
        }
        const names = new Set([
            "clash-win32.exe", "clash-win64.exe", "clash-windows-arm64.exe",
            "mihomo-windows-386.exe", "mihomo-windows-amd64.exe", "mihomo-windows-arm64.exe"
        ]);
        if (!names.has(path.basename(resolved).toLowerCase())) {
            throw new Error("Core binary is not an allowed packaged executable");
        }
        return resolved;
    }

    function hashFile(file) {
        return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    }
}

module.exports = { registerNativeAdminIpc };
