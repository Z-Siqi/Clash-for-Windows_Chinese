"use strict";

const { createSettingsRepository } = require("../../features/settings/settings-repository");
const { createProfilesRepository } = require("../../features/profiles/profiles-repository");

function registerProfileDownloadIpc({ ipcMain, app, getMainWindow, fs, path, yaml, forkWorker, workerPath, Notification, platform = process.platform }) {
    const jobs = new Map();
    const homes = [path.resolve(app.getPath("home"), ".config", "clash"), path.resolve(app.getPath("exe"), "..", "data")];
    const normalize = value => platform === "win32" ? value.toLowerCase() : value;
    function localFile(folder, name) {
        if (typeof name !== "string" || !name || name === "." || name === ".." || /[\\/:\0]/.test(name)) throw new Error("Invalid profile filename");
        const file = path.join(folder, name);
        if (fs.existsSync(file) && normalize(path.dirname(fs.realpathSync(file))) !== normalize(folder)) throw new Error("Profile file escapes its directory");
        return file;
    }
    function authorize(event) {
        const window = getMainWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Invalid profile download sender");
    }
    ipcMain.handle("profile-download", (event, request = {}) => {
        authorize(event);
        if (!Number.isSafeInteger(request.id) || request.id < 1 || jobs.has(request.id) || jobs.size >= 4) throw new Error("Invalid profile download job");
        if (typeof request.home !== "string" || !homes.some(home => normalize(home) === normalize(path.resolve(request.home)))) throw new Error("Unsupported profile home");
        const url = new URL(request.url);
        if (!["http:", "https:"].includes(url.protocol) || typeof request.headersString !== "string") throw new Error("Unsupported profile download request");
        const home = fs.realpathSync(request.home);
        localFile(home, "cfw-settings.yaml");
        const settings = createSettingsRepository({ fs, path, yaml }).load(home);
        const configured = path.resolve(settings.profilePath || path.join(home, "profiles"));
        const profilesPath = fs.realpathSync(configured);
        if (!settings.profilePath && normalize(profilesPath) !== normalize(configured)) throw new Error("Default profile directory escapes its home");
        localFile(profilesPath, "list.yml");
        const profiles = createProfilesRepository({ fs, path, yaml }).load(profilesPath);
        for (const profile of profiles.files) {
            if (profile.time === "list.yml" || !/^[\w-]+\.ya?ml$/.test(profile.time)) throw new Error("Invalid saved profile filename");
            localFile(profilesPath, profile.time);
            localFile(profilesPath, profile.time.replace(/\.ya?ml$/, ".base.yml"));
            localFile(profilesPath, profile.time.replace(/\.ya?ml$/, ".change.yml"));
        }
        const confData = yaml.parse(fs.readFileSync(localFile(home, "config.yaml"), "utf8")) || {};
        const logPath = localFile(fs.realpathSync(app.getPath("temp")), "cfw-parser.log");
        // The privileged worker receives only saved policy; IPC cannot select parser code or paths.
        const worker = forkWorker(workerPath, [], { serviceName: "CFW profile parsers", stdio: "ignore" });
        return new Promise((resolve, reject) => {
            let settled = false;
            function finish(error, value) {
                if (settled) return;
                settled = true;
                clearTimeout(timer); jobs.delete(request.id); worker.kill();
                error ? reject(new Error("Profile download worker failed")) : resolve(value);
            }
            const timer = setTimeout(() => finish(true), 120000);
            jobs.set(request.id, { sender: event.sender, cancel: () => finish(true) });
            worker.on("exit", () => finish(true));
            worker.on("message", message => {
                if (message.type === "result") finish(!message.ok, message.value);
                else if (message.type === "notify" && settings.showNotifications && Notification) {
                    new Notification({ title: String(message.title || ""), body: String(message.body || ""), silent: message.silent !== false }).show();
                }
            });
            worker.postMessage({
                type: "download", url: request.url, headersString: request.headersString,
                app: { clashPath: home, profilesPath, profiles, settings, confData },
                language: request.language === 1 ? 1 : 0,
                logPath
            });
        });
    });
    ipcMain.on("profile-download-cancel", (event, id) => {
        authorize(event);
        const job = jobs.get(id);
        if (job?.sender === event.sender) job.cancel();
    });
    app.once("will-quit", () => { for (const job of [...jobs.values()]) job.cancel(); });
}

module.exports = { registerProfileDownloadIpc };
