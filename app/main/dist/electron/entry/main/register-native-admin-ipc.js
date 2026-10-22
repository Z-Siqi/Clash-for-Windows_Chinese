"use strict";

const { createClashServiceApi } = require("../../core/network/clash-service-api");
const { createFirewallRuntime } = require("../../features/network/firewall-runtime");
const { createServiceModeManager, SERVICE_STATUS } = require("../../features/service-mode/service-mode-manager");
const { createSystemProxyRuntime } = require("../../features/network/system-proxy-runtime");
const { createMacSystemProxyCommand } = require("../../features/network/mac-system-proxy-command");
const { getDefaultBypass } = require("../../features/network/proxy-defaults");
const { createSettingsRepository } = require("../../features/settings/settings-repository");
const { readServiceCredentials, createServiceCredentials } = require("../../core/network/service-credentials");
const { parsePort } = require("../../core/network/tcp-port");
const { createTunRuntime } = require("../../features/tun/tun-runtime");
const { createProfileNetworkEffects } = require("../../features/network/profile-network-effects");

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
    getPort,
    shell,
    platform = process.platform,
    arch = process.arch,
    resourcesPath = process.resourcesPath,
    createTapRuntime = createTunRuntime
}) {
    const packagedResourcesPath = resourcesPath || path.dirname(app.getPath("exe"));
    const expectedFilesPath = app.isPackaged
        ? path.join(packagedResourcesPath, "static", "files")
        : path.resolve("static", "files");
    const allowedClashPaths = new Set([
        path.resolve(app.getPath("home"), ".config", "clash"),
        path.resolve(app.getPath("exe"), "..", "data")
    ].map(normalizePath));
    let tunProcess = null;
    let tunRuntime;
    let tunQueue = Promise.resolve();
    let tunStop = Promise.resolve();
    let tunStopPending = 0;
    const tunStarts = new Map();
    let tunProcessRequestId;
    let cancelDhcp;
    let serviceMutation = false;
    let tapSetupPending = 0;
    const profileNetworkEffects = createProfileNetworkEffects({ childProcess, getPort });
    app.once("will-quit", event => {
        cancelDhcp?.();
        for (const startup of tunStarts.values()) startup.cancelled = true;
        if (!tunProcess && tunStarts.size === 0 && !tunStopPending) return;
        // Async process cleanup must finish before Electron stops its event loop.
        event.preventDefault();
        tunQueue.then(stopManagedTap).catch(() => {}).finally(() => { app.quit(); });
    });

    function stopManagedTap() {
        if (!tunProcess) return tunStop;
        const processHandle = tunProcess, runtime = tunRuntime, requestId = tunProcessRequestId;
        tunProcess = null; tunProcessRequestId = undefined;
        tunStopPending++;
        const stopped = tunStop.then(() => runtime.killSpawned(processHandle)).catch(error => {
            // Retain ownership on failure so the next stop/setup can retry.
            if (!tunProcess) { tunProcess = processHandle; tunRuntime = runtime; tunProcessRequestId = requestId; }
            throw error;
        }).finally(() => { tunStopPending--; });
        tunStop = stopped.catch(() => {});
        return stopped;
    }

    ipcMain.handle("native-admin", async function(event, scope, action, payload = {}) {
        const mainWindow = getMainWindow();
        if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
            throw new Error("Native administrator request did not originate from the main window");
        }
        const filesPath = requireExactPath(payload.filesPath, expectedFilesPath, "packaged files");
        const clashPath = requireAllowedClashPath(payload.clashPath);
        if (scope === "terminal") {
            if (platform !== "win32") return false;
            if (action === "loopback") return shell.openPath(path.join(filesPath, "win", "common", "EnableLoopback.exe"));
            const port = parsePort(payload.port);
            if (action !== "open" || !Number.isInteger(payload.selection) || ![0, 1, 2].includes(payload.selection) || typeof payload.elevated !== "boolean" || port === null) throw new Error("Invalid terminal request");
            const terminals = ["cmd", "powershell", "wt"];
            const proxy = `http://127.0.0.1:${port}`;
            if (payload.elevated) {
                return new Promise((resolve, reject) => {
                    // Every command fragment is fixed except an already validated integer port.
                    sudoPrompt.exec(`set "http_proxy=${proxy}" && set "https_proxy=${proxy}" && start "" ${terminals[payload.selection]}`, { name: "Clash for Windows" }, error => error ? reject(new Error("Terminal elevation failed")) : resolve(true));
                });
            }
            const child = childProcess.spawn(terminals[payload.selection], [], {
                cwd: app.getPath("home"), windowsHide: false, detached: true, stdio: "ignore",
                env: { ...process.env, http_proxy: proxy, https_proxy: proxy }
            });
            child.on("error", () => {}); child.unref();
            return true;
        }
        if (scope === "profile-network") {
            if (!["has-tap", "renew-dhcp"].includes(action)) throw new Error("Unsupported profile network operation");
            if (platform !== "win32") return false;
            if (action === "has-tap") return tapSetupPending ? false : profileNetworkEffects.hasTap();
            cancelDhcp?.();
            cancelDhcp = profileNetworkEffects.renewDhcp();
            return true;
        }
        const runMacCommand = createMacSystemProxyCommand({
            platform, arch, path, serviceApi: createClashServiceApi({ client: axios, getCredentials: () => readServiceCredentials({ fs, path, home: clashPath }) }),
            isDevelopmentMode: () => !app.isPackaged, getFilesPath: () => filesPath
        });
        if (scope === "tun") {
            if (platform !== "win32") return null;
            if (!["setup", "start", "stop", "cancel"].includes(action)) throw new Error("Unsupported TAP operation");
            if (action === "start" && payload.allowMulticast !== undefined && typeof payload.allowMulticast !== "boolean") throw new Error("Invalid TAP multicast preference");
            const requestId = payload.requestId;
            if (requestId !== undefined && (typeof requestId !== "string" || !/^\d{1,16}-\d{1,16}$/.test(requestId))) throw new Error("Invalid TAP request identity");
            if (action === "cancel") {
                if (requestId === undefined) throw new Error("Missing TAP request identity");
                const startup = tunStarts.get(requestId);
                if (startup) startup.cancelled = true;
                else if (tunProcessRequestId === requestId) {
                    await stopManagedTap();
                }
                return null;
            }
            // Cancellation bypasses the native queue so an in-flight route poll can stop.
            if (action === "setup" && typeof payload.install !== "boolean") throw new Error("Invalid TAP setup request");
            if (action === "stop" || action === "setup") for (const startup of tunStarts.values()) startup.cancelled = true;
            if (action === "start" && tapSetupPending) return null;
            if (action === "setup") { tapSetupPending++; profileNetworkEffects.invalidateTap(); }
            const startup = action === "start" ? { cancelled: false } : null;
            if (startup) {
                if (requestId !== undefined && tunStarts.has(requestId)) throw new Error("Duplicate TAP request identity");
                tunStarts.set(requestId ?? startup, startup);
            }
            const task = tunQueue.then(async () => {
                if (startup?.cancelled) return null;
                if (action === "stop") {
                    await stopManagedTap();
                    return null;
                }
                // Uninstall does not use any saved address preferences.
                const tapInfo = action === "setup" && !payload.install ? {} : payload.tapInfo || {};
                if (typeof tapInfo !== "object" || Array.isArray(tapInfo)) throw new Error("Invalid TAP settings");
                // Driver removal uses only the fixed packaged driver identity;
                // invalid legacy address preferences must not prevent uninstall.
                const runtime = createTapRuntime({ childProcess, sudoExec: sudoPrompt.exec, path, platform, arch, filesPath, tapInfo });
                if (action === "setup") {
                    // Release the adapter handle before PnP installs or removes it.
                    await stopManagedTap();
                    return runtime.setupTapDevice(payload.install);
                }
                const mixedPort = payload.mixedPort === 0 ? 0 : parsePort(payload.mixedPort);
                if (mixedPort === null) throw new Error("Invalid TAP proxy port");
                await stopManagedTap();
                tunRuntime = runtime;
                tunProcess = await runtime.spawnTun2socks({ currentProcess: null, mixedPort, allowMulticast: payload.allowMulticast === true, isCurrent: () => !startup.cancelled,
                    // Keep ownership even if readiness and subsequent cleanup fail.
                    onSpawn: processHandle => { tunProcess = processHandle; tunProcessRequestId = requestId; } });
                if (tunProcess) tunProcessRequestId = requestId;
                return tunProcess ? { pid: tunProcess.pid } : null;
            }).finally(() => {
                if (startup) tunStarts.delete(requestId ?? startup);
                if (action === "setup") { tapSetupPending--; profileNetworkEffects.invalidateTap(); }
            });
            tunQueue = task.catch(() => {});
            return task;
        }

        if (scope === "system-proxy") {
            const runtime = createSystemProxyRuntime({
                platform, arch, childProcess, path, filesPath, clashPath, runMacCommand,
                parseBypass: require("yaml").parse, defaultBypass: getDefaultBypass(platform)
            });
            if (action === "status") return runtime.getStatus();
            if (action !== "set" || typeof payload.enabled !== "boolean" || parsePort(payload.mixedPort) === null) throw new Error("Invalid system proxy request");
            const settingsFile = path.join(clashPath, "cfw-settings.yaml");
            if (fs.existsSync(settingsFile) && normalizePath(path.dirname(fs.realpathSync(settingsFile))) !== normalizePath(clashPath)) throw new Error("System proxy settings escape their home");
            const settings = createSettingsRepository({ fs, path, yaml: require("yaml") }).load(clashPath);
            if (payload.enabled && settings.systemProxyTypeIndex === 1 && parsePort(payload.innerServerPort) === null) throw new Error("Invalid PAC port");
            return runtime.set({ enabled: payload.enabled, settings, mixedPort: parsePort(payload.mixedPort), innerServerPort: parsePort(payload.innerServerPort) });
        }
        if (scope === "dns") {
            if (platform !== "darwin") return { success: false, output: "" };
            let value;
            if (action === "query") value = "query";
            else if (action === "reset") value = "reset";
            else if (action === "set" && Array.isArray(payload.addresses) && payload.addresses.length > 0 && payload.addresses.length <= 16 && payload.addresses.every(address => typeof address === "string" && require("net").isIP(address))) value = payload.addresses.join(",");
            else throw new Error("Invalid DNS operation");
            return runMacCommand(["-dns", value]);
        }

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
            const serviceApi = createClashServiceApi({ client: axios, getCredentials: () => readServiceCredentials({ fs, path, home: clashPath }) });
            const manager = createServiceModeManager({
                platform,
                arch,
                fs,
                path,
                sudoExec: sudoPrompt.exec,
                serviceApi,
                getFilesPath: () => filesPath,
                getClashPath: () => clashPath,
                getTempPath: () => app.getPath("temp"),
                hashFile,
                prepareCredentials: () => createServiceCredentials({ fs, path, crypto, home: clashPath,
                    protectFile: platform === "win32" ? file => {
                        const identity = childProcess.execFileSync("whoami", ["/user", "/fo", "csv", "/nh"], { windowsHide: true }).toString();
                        const sid = identity.match(/S-1-5-[\d-]+/)?.[0];
                        if (!sid) throw new Error("Cannot secure Service Mode credentials");
                        childProcess.execFileSync("icacls", [file, "/inheritance:r", "/grant:r", `*${sid}:(F)`, "*S-1-5-18:(F)", "*S-1-5-32-544:(F)"], { windowsHide: true });
                    } : undefined
                })
            });
            if (action === "status") {
                const status = await manager.statusService();
                return Object.keys(SERVICE_STATUS).find(name => SERVICE_STATUS[name] === status) || "Unknown";
            }
            if (action === "need-update") {
                if (manager.needUpdate()) return true;
                try { await serviceApi.ping(400); }
                catch (error) { return error.code === "CFW_SERVICE_UPDATE_REQUIRED" || error.response?.status === 403; }
                return false;
            }
            if (["install", "uninstall", "update"].includes(action)) {
                if (serviceMutation) throw new Error("A Service Mode operation is already in progress");
                serviceMutation = true;
                try {
                    if (action === "install") {
                        const method = payload.method === undefined ? 0 : Number(payload.method);
                        if (platform === "win32" && ![0, 1].includes(method)) {
                            throw new Error("Unsupported Windows Service Mode install method");
                        }
                        await manager.installService(platform === "win32" ? method : undefined);
                    } else if (action === "uninstall") {
                        await manager.uninstallService();
                    } else {
                        await manager.updateService();
                    }
                    return true;
                } finally { serviceMutation = false; }
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
            "clash-win64.exe", "clash-windows-arm64.exe",
            "mihomo-windows-amd64.exe", "mihomo-windows-arm64.exe"
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
