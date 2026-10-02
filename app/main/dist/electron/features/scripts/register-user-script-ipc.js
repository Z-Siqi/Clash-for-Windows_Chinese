"use strict";

function registerUserScriptIpc({ ipcMain, app, getMainWindow, fs, path, yaml, forkWorker, workerPath, dialog, Notification, clashApi }) {
    let worker;
    let sequence = 0;
    const jobs = new Map();
    const contexts = new Map();
    const allowedHomes = [path.resolve(app.getPath("home"), ".config", "clash"), path.resolve(app.getPath("exe"), "..", "data")];
    const normalize = value => process.platform === "win32" ? value.toLowerCase() : value;
    ipcMain.handle("mixin-code-validate", (event, source) => {
        const window = getMainWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Invalid Mixin validation sender");
        if (typeof source !== "string" || source.length > 1048576) throw new Error("Invalid Mixin source");
        try { new (require("vm").Script)(`(function(module, exports, require) {\n${source}\n})`); }
        catch (_error) { throw new Error("JavaScript Mixin has invalid syntax"); }
        if (!/module\.exports\.parse\s*=/.test(source)) throw new Error("JavaScript Mixin must export a parse function");
        return true;
    });
    function resetWorker() {
        for (const job of jobs.values()) { clearTimeout(job.timeout); job.reject(new Error("User script worker stopped")); }
        jobs.clear(); contexts.clear(); worker = null;
    }
    function getWorker() {
        if (worker) return worker;
        worker = forkWorker(workerPath, [], { serviceName: "CFW user scripts", stdio: "ignore" });
        const current = worker;
        current.on("exit", () => { if (worker === current) resetWorker(); });
        current.on("message", async message => {
            if (message.type === "result") {
                const job = jobs.get(message.job);
                if (!job) return;
                clearTimeout(job.timeout); jobs.delete(message.job);
                message.ok ? job.resolve(message.value) : job.reject(new Error("User script failed"));
                return;
            }
            if (message.type !== "effect") return;
            const context = contexts.get(message.job);
            if (!context) return;
            try {
                let value;
                if (message.method === "dialog") value = await dialog.showMessageBox(context.window, { title: "Clash for Windows", ...message.args[0] });
                else if (message.method === "resolveHost") value = (await clashApi.queryDns(...message.args)).data;
                else if (message.method === "notify") {
                    if (context.showNotifications) {
                        const [title, body, options] = message.args;
                        const notification = new Notification({ ...options, title: String(title), body: String(body || ""), silent: true });
                        notification.on("click", () => {
                            if (!options?.hideWindowOnClick) context.window.show();
                            if (worker === current) current.postMessage({ type: "notification-click", id: message.id });
                        });
                        notification.show();
                    }
                } else throw new Error("Unsupported script context operation");
                current.postMessage({ type: "effect-result", id: message.id, ok: true, value });
            } catch (_error) { current.postMessage({ type: "effect-result", id: message.id, ok: false }); }
        });
        return worker;
    }
    ipcMain.handle("user-script", (event, request = {}) => {
        const window = getMainWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("User script request did not originate from the dashboard main frame");
        if (!["profile", "proxy", "mixin", "tray"].includes(request.scriptType)) throw new Error("Unsupported user script type");
        if (typeof request.home !== "string" || !allowedHomes.some(home => normalize(home) === normalize(path.resolve(request.home)))) throw new Error("Unsupported user script home");
        if (jobs.size >= 16) throw new Error("Too many pending user scripts");
        const home = fs.realpathSync(request.home);
        const settingsFile = path.join(home, "cfw-settings.yaml");
        if (fs.existsSync(settingsFile) && path.dirname(fs.realpathSync(settingsFile)) !== home) throw new Error("User script settings escape their home");
        let settings;
        try { settings = fs.existsSync(settingsFile) ? yaml.parse(fs.readFileSync(settingsFile, "utf8")) || {} : {}; }
        catch (_error) { throw new Error("User script settings could not be loaded"); }
        // Source is read from the user's saved configuration, never supplied in IPC.
        const mixin = request.scriptType === "mixin";
        const tray = request.scriptType === "tray";
        let trayCode;
        if (tray) {
            if (typeof settings.trayScriptPath !== "string" || !settings.trayScriptPath) return "";
            trayCode = fs.readFileSync(settings.trayScriptPath, "utf8");
        }
        if (mixin && (Number(settings.mixinType) !== 1 || !settings.mixinCode)) return request.payload?.content;
        if (!mixin && !tray && !settings.scriptsText) return;
        let scripts;
        try { scripts = mixin || tray ? {} : yaml.parse(settings.scriptsText)?.scripts || {}; }
        catch (_error) { return; }
        if (!mixin && !tray && !scripts[request.scriptType]?.code && !scripts[request.scriptType]?.file) return;
        const current = getWorker();
        const job = ++sequence;
        contexts.set(job, { window, showNotifications: settings.showNotifications === true });
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => { if (worker === current) { current.kill(); resetWorker(); } }, 30000);
            jobs.set(job, { resolve, reject, timeout });
            current.postMessage({
                type: "run", job, home, scriptsText: settings.scriptsText,
                scriptType: request.scriptType, payload: request.payload,
                mixinCode: mixin ? settings.mixinCode : undefined,
                trayCode, trayPath: tray ? settings.trayScriptPath : undefined,
                logPath: path.join(app.getPath("temp"), "cfw-script.log")
            });
        });
    });
    app.once("will-quit", () => { worker?.kill(); resetWorker(); });
}

module.exports = { registerUserScriptIpc };
