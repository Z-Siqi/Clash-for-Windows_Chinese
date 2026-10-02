"use strict";

const { resolveCoreBinaryPath } = require("../../core/clash-core/core-selection");

function registerCoreLifecycleIpc({ ipcMain, app, getMainWindow, runtime, clashApi, fs, path, filesPath, platform, arch }) {
    let processHandle = null;
    let logFile = "";
    let queue = Promise.resolve();
    const allowedHomes = [
        path.resolve(app.getPath("home"), ".config", "clash"),
        path.resolve(app.getPath("exe"), "..", "data")
    ];
    function normalize(value) { return platform === "win32" ? value.toLowerCase() : value; }
    function validateHome(value) {
        if (typeof value !== "string" || !allowedHomes.some(home => normalize(home) === normalize(path.resolve(value)))) {
            throw new Error("Core data directory is outside the application homes");
        }
        // The renderer chooses only a known home; native paths and binaries are owned here.
        const home = fs.realpathSync(value);
        const logs = fs.realpathSync(path.join(home, "logs"));
        if (normalize(path.dirname(logs)) !== normalize(home)) throw new Error("Core logs directory escapes its home");
        return home;
    }
    function send(event, type, value) {
        if (!event.sender.isDestroyed()) event.sender.send("core-lifecycle-event", { type, value });
    }
    ipcMain.handle("core-lifecycle", (event, operation, request = {}) => {
        const window = getMainWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
            throw new Error("Core lifecycle request did not originate from the dashboard main frame");
        }
        if (!["start", "stop", "status"].includes(operation)) throw new Error("Unsupported core lifecycle operation");
        if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("Invalid core lifecycle request");
        if (operation === "status") return runtime.getStatus(clashApi);
        const task = queue.then(async () => {
            if (operation === "stop") {
                await runtime.stop({ processHandle, lightweightMode: request.lightweightMode === true, platform });
                processHandle = null;
                return null;
            }
            if (!["clash", "mihomo", undefined].includes(request.coreType)) throw new Error("Unsupported core selection");
            const logLevel = request.logLevel || "info";
            if (!["silent", "error", "warning", "info", "debug"].includes(logLevel)) throw new Error("Unsupported core log level");
            const clashPath = validateHome(request.clashPath);
            if (processHandle) {
                await runtime.stop({ processHandle, lightweightMode: true, platform });
                processHandle = null;
            }
            const result = await runtime.start({
                clashPath,
                binaryPath: resolveCoreBinaryPath({ path, filesPath, platform, arch, coreType: request.coreType }),
                coreType: request.coreType,
                logLevel,
                isLocalMode: request.isLocalMode === true,
                lightweightMode: request.lightweightMode === true,
                devMode: false,
                clashApi,
                startupErrorMessage: "Packaged core failed to start",
                onLogFile: value => {
                    const logs = fs.realpathSync(path.join(clashPath, "logs"));
                    if (typeof value !== "string" || normalize(path.dirname(path.resolve(value))) !== normalize(logs)
                        || (fs.existsSync(value) && normalize(path.dirname(fs.realpathSync(value))) !== normalize(logs))) {
                        throw new Error("Core log file escapes its data directory");
                    }
                    logFile = value; send(event, "log", value);
                },
                onCoreReady: () => send(event, "ready"),
                onServiceFallback: async () => {}
            });
            processHandle = result.processHandle || null;
            return { ...result, processHandle: processHandle ? { pid: processHandle.pid } : null };
        });
        queue = task.catch(() => {});
        return task;
    });
    app.once("will-quit", () => runtime.killProcess(processHandle, platform));
    return { getLogFile: () => logFile };
}

module.exports = { registerCoreLifecycleIpc };
