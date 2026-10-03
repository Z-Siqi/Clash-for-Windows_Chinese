"use strict";

const { createSettingsRepository } = require("../../features/settings/settings-repository");
const { createProfilesRepository } = require("../../features/profiles/profiles-repository");
const { createCoreConfigRepository } = require("../../features/settings/core-config-repository");
const { createPacServerRuntime } = require("../../features/network/pac-server-runtime");
const { defaultPac } = require("../../features/network/proxy-defaults");
const { writeAtomic } = require("../../core/storage/atomic-file");
const { readBoundedText } = require("../../core/storage/read-bounded-text");
const { updateYamlValue } = require("../../core/storage/yaml-file");
const { parsePort } = require("../../core/network/tcp-port");
const { createGeoipRuntime } = require("../../features/clash-core/geoip-runtime");

function registerRepositoryIpc({ ipcMain, app, getMainWindow, fs, path, yaml, filesPath, getPort, uuid, Koa, dialog, shell, got, zlib, tarStream, platform = process.platform, arch = process.arch }) {
    const settings = createSettingsRepository({ fs, path, yaml });
    const profiles = createProfilesRepository({ fs, path, yaml });
    const allowedHomes = [path.resolve(app.getPath("home"), ".config", "clash"), path.resolve(app.getPath("exe"), "..", "data")];
    const normalize = value => platform === "win32" ? value.toLowerCase() : value;
    const pacServer = Koa && createPacServerRuntime({ Koa, getPort, defaultPac });
    const watchers = new Map();
    const watchedSenders = new WeakSet();
    const geoipJobs = new Set();
    const geoipRuntime = got && createGeoipRuntime({ fs, path, got, zlib, tarStream });
    function stopWatcher(sender) { watchers.get(sender)?.close(); watchers.delete(sender); }
    app.once?.("will-quit", () => { for (const sender of watchers.keys()) stopWatcher(sender); });
    if (pacServer) app.once("will-quit", () => pacServer.stop());
    function requireHome(value, initialize = false) {
        if (typeof value !== "string" || !allowedHomes.some(home => normalize(home) === normalize(path.resolve(value)))) {
            throw new Error("Unsupported application data directory");
        }
        if (initialize) fs.mkdirSync(value, { recursive: true });
        return fs.realpathSync(value);
    }
    function requireLocalFile(folder, name) {
        const file = path.join(folder, name);
        if (fs.existsSync(file) && normalize(path.dirname(fs.realpathSync(file))) !== normalize(folder)) {
            throw new Error("Repository file escapes its data directory");
        }
    }
    function requireProfiles(home, value) {
        // Custom profile folders are an existing persisted user preference.
        const custom = settings.load(home).profilePath;
        const configured = custom || path.join(home, "profiles");
        if (typeof value !== "string" || normalize(path.resolve(value)) !== normalize(path.resolve(configured))) {
            throw new Error("Unsupported profiles directory");
        }
        const resolved = path.resolve(configured);
        fs.mkdirSync(resolved, { recursive: true });
        const folder = fs.realpathSync(resolved);
        if (!custom && normalize(folder) !== normalize(resolved)) throw new Error("Default profiles directory escapes its home");
        requireLocalFile(folder, "list.yml");
        return folder;
    }
    ipcMain.on("cfw-repository", (event, operation, request = {}) => {
        try {
            const window = getMainWindow();
            if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
                throw new Error("Repository request did not originate from the dashboard main frame");
            }
            if (!["settings-load", "settings-save", "profiles-load", "profiles-save", "profiles-initialize"].includes(operation)) {
                throw new Error("Unsupported repository operation");
            }
            const home = requireHome(request.home);
            requireLocalFile(home, "cfw-settings.yaml");
            let value;
            if (operation === "settings-load") {
                let language;
                value = { settings: settings.load(home, selected => { language = selected; }), language };
            } else if (operation === "settings-save") {
                if (!request.settings || typeof request.settings !== "object" || Array.isArray(request.settings)) throw new Error("Invalid settings object");
                settings.save(home, request.settings);
            } else {
                const folder = requireProfiles(home, request.profilesPath);
                if (operation === "profiles-load") value = profiles.load(folder);
                else if (operation === "profiles-initialize") profiles.initialize(folder);
                else {
                    if (!request.profiles || !Array.isArray(request.profiles.files) || !Number.isInteger(request.profiles.index)) throw new Error("Invalid profiles list");
                    profiles.save(folder, request.profiles);
                }
            }
            event.returnValue = { ok: true, value };
        } catch (_error) {
            // IPC errors must not serialize YAML excerpts or controller credentials.
            event.returnValue = { ok: false, error: "Application repository operation failed" };
        }
    });
    ipcMain.handle("profile-files", async (event, operation, request = {}) => {
        try {
            const window = getMainWindow();
            if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Invalid profile file sender");
            if (!["watch", "stop-watch", "read-profile", "write-profile", "create-local", "import-dialog", "delete-profile", "open-profile", "reveal-profile", "read-diff", "initialize-diff", "write-diff", "delete-diff", "modification-times", "cleanup-orphans"].includes(operation)) throw new Error("Unsupported profile file operation");
            if (operation === "stop-watch") { stopWatcher(event.sender); return { ok: true }; }
            const home = requireHome(request.home);
            requireLocalFile(home, "cfw-settings.yaml");
            const folder = requireProfiles(home, request.profilesPath);
            const list = profiles.load(folder).files;
            function profileFile(name) {
                if (typeof name !== "string" || name === "list.yml" || !/^[\w-]+(?:\.(?:base|change))?\.ya?ml$/.test(name)) throw new Error("Invalid profile filename");
                requireLocalFile(folder, name);
                return path.join(folder, name);
            }
            let value;
            function createLocal(source) {
                if (typeof source !== "string" || source.length > 33554432) throw new Error("Invalid profile source");
                const time = `${Date.now()}-${uuid()}.yml`;
                writeAtomic({ fs, path, file: profileFile(time), content: source });
                return time;
            }
            if (operation === "watch") {
                stopWatcher(event.sender);
                const watcher = fs.watch(folder, (_type, filename) => {
                    if (event.sender.isDestroyed()) return;
                    try {
                        if (profiles.load(folder).files.some(profile => profile.time === filename)) event.sender.send("profile-files-changed", filename);
                    } catch (_error) { /* An incomplete external edit must not crash the watcher. */ }
                });
                watchers.set(event.sender, watcher);
                watcher.on("error", () => { if (watchers.get(event.sender) === watcher) stopWatcher(event.sender); });
                if (!watchedSenders.has(event.sender)) {
                    watchedSenders.add(event.sender);
                    event.sender.once("destroyed", () => stopWatcher(event.sender));
                    event.sender.on("did-start-loading", () => stopWatcher(event.sender));
                }
            } else if (operation === "create-local") {
                let source = request.source;
                if (source === undefined) {
                    const selected = request.sourceTime || list[profiles.load(folder).index]?.time;
                    if (selected && list.some(profile => profile.time === selected)) source = fs.readFileSync(profileFile(selected), "utf8");
                    else if (request.sourceTime) throw new Error("Unknown source profile");
                    else { requireLocalFile(home, "config.yaml"); source = fs.readFileSync(path.join(home, "config.yaml"), "utf8"); }
                }
                value = createLocal(source);
            } else if (operation === "import-dialog") {
                const result = await dialog.showOpenDialog(window, { properties: ["openFile"], filters: [{ name: "YAML", extensions: ["yml", "yaml"] }] });
                value = [];
                if (!result.canceled) for (const file of result.filePaths) {
                    const name = path.basename(file);
                    if (list.some(profile => profile.url === "" && profile.name === name)) continue;
                    value.push({ time: createLocal(readBoundedText({ fs, file })), name, url: "", selected: [] });
                }
            } else if (["delete-profile", "open-profile", "reveal-profile", "read-diff", "initialize-diff", "write-diff", "delete-diff"].includes(operation)) {
                if (!list.some(profile => profile.time === request.time)) throw new Error("Unknown profile");
                const file = profileFile(request.time);
                const stem = request.time.replace(/\.ya?ml$/, "");
                const base = profileFile(`${stem}.base.yml`);
                const change = profileFile(`${stem}.change.yml`);
                if (operation === "open-profile") value = await shell.openPath(file);
                else if (operation === "reveal-profile") shell.showItemInFolder(file);
                else if (operation === "read-diff") value = fs.existsSync(base) && fs.existsSync(change)
                    ? { initialized: true, base: fs.readFileSync(base, "utf8"), change: fs.readFileSync(change, "utf8") }
                    : { initialized: false };
                else if (operation === "initialize-diff") {
                    const source = fs.readFileSync(file, "utf8");
                    for (const target of [base, change]) writeAtomic({ fs, path, file: target, content: source });
                    value = { initialized: true, base: source, change: source };
                } else if (operation === "write-diff") {
                    if (typeof request.source !== "string" || request.source.length > 33554432) throw new Error("Invalid diff source");
                    writeAtomic({ fs, path, file: change, content: request.source });
                } else for (const target of operation === "delete-profile" ? [file, base, change] : [base, change]) {
                    if (fs.existsSync(target)) fs.unlinkSync(target);
                }
            } else if (operation === "read-profile" || operation === "write-profile") {
                if (!list.some(profile => profile.time === request.time)) throw new Error("Unknown profile");
                const file = profileFile(request.time);
                if (operation === "read-profile") value = fs.readFileSync(file, "utf8");
                else {
                    if (typeof request.source !== "string" || request.source.length > 33554432) throw new Error("Invalid profile source");
                    writeAtomic({ fs, path, file, content: request.source });
                }
            } else if (operation === "modification-times") {
                value = {};
                for (const profile of list) {
                    try { value[profile.time] = fs.statSync(profileFile(profile.time)).mtimeMs; }
                    catch (_error) { value[profile.time] = 0; }
                }
            } else {
                value = 0;
                const active = new Set(list.map(profile => profile.time));
                for (const name of fs.readdirSync(folder)) {
                    if (!/^\d+(?:-[a-f\d-]+)?\.yml$/.test(name) || active.has(name)) continue;
                    const file = profileFile(name);
                    if (fs.statSync(file).mtimeMs < Date.now() - 30 * 86400000) { fs.unlinkSync(file); value++; }
                }
            }
            return { ok: true, value };
        } catch (_error) { return { ok: false, error: "Profile file operation failed" }; }
    });
    if (filesPath && getPort && uuid) ipcMain.handle("core-config", async (event, operation, request = {}) => {
        try {
            const window = getMainWindow();
            if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
                throw new Error("Invalid core configuration sender");
            }
            if (!["initialize", "load", "randomize-ports", "start-pac", "update-value", "metadata", "reset", "update-geoip"].includes(operation)) throw new Error("Unsupported core configuration operation");
            const home = requireHome(request.home, operation === "initialize");
            for (const file of ["config.yaml", "config.yml", "cfw-settings.yaml", "Country.mmdb", "wintun.dll"]) requireLocalFile(home, file);
            const config = createCoreConfigRepository({
                fs, path, yaml, platform, arch, uuid,
                shouldReplaceWintun: async () => request.replaceWintun === true
            });
            let value;
            if (operation === "initialize") await config.initialize(home, filesPath);
            else if (operation === "load") value = config.load(home);
            else if (operation === "update-geoip") {
                if (platform === "win32" || !geoipRuntime || !Number.isSafeInteger(request.id) || request.id < 1 || geoipJobs.has(home)) throw new Error("GeoIP update is unavailable");
                geoipJobs.add(home);
                try {
                    value = await geoipRuntime.update({ home, url: request.url, token: request.token, onProgress: percent => {
                        if (!event.sender.isDestroyed()) event.sender.send("geoip-progress", { id: request.id, percent });
                    } });
                } finally { geoipJobs.delete(home); }
            }
            else if (operation === "metadata") {
                const file = path.join(home, "Country.mmdb");
                value = { geoipModifiedAt: fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0 };
            } else if (operation === "reset") {
                for (const name of ["config.yaml", "Country.mmdb"]) {
                    const file = path.join(home, name);
                    if (fs.existsSync(file)) fs.unlinkSync(file);
                }
            } else if (operation === "update-value") {
                const key = request.key;
                const valid = ["allow-lan", "ipv6"].includes(key) ? typeof request.value === "boolean"
                    : key === "mixed-port" ? parsePort(request.value) !== null
                    : key === "log-level" ? ["silent", "error", "warning", "info", "debug"].includes(request.value)
                    : key === "secret" ? typeof request.value === "string" && request.value.length > 0 && request.value.length <= 1024
                    : key === "bind-address" ? typeof request.value === "string" && request.value.length > 0 && request.value.length <= 253 && !/[\r\n\0]/.test(request.value)
                    : false;
                if (!valid) throw new Error("Invalid core configuration value");
                updateYamlValue({ fs, path, yaml, file: path.join(home, "config.yaml"), key, value: key === "mixed-port" ? parsePort(request.value) : request.value });
            }
            else if (operation === "start-pac") {
                if (!pacServer || platform !== "win32") throw new Error("PAC server is unavailable on this platform");
                value = await pacServer.start({
                    getSettings: () => settings.load(home), getMixedPort: () => config.load(home)["mixed-port"]
                });
            }
            else {
                value = config.load(home);
                await config.randomizePorts({
                    clashPath: home, confData: value, settings: settings.load(home),
                    devMode: !app.isPackaged, lightweightMode: request.lightweightMode === true,
                    getPort, onChange: next => { value = next; }
                });
            }
            return { ok: true, value };
        } catch (_error) {
            return { ok: false, error: "Core configuration operation failed" };
        }
    });
}

module.exports = { registerRepositoryIpc };
