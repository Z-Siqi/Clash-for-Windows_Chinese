"use strict";

const { writeAtomic } = require("../../core/storage/atomic-file");
const { readBoundedText } = require("../../core/storage/read-bounded-text");

function registerProviderFileIpc({ ipcMain, app, getMainWindow, fs, path, dialog, shell, getProviders, platform = process.platform }) {
    const normalize = value => platform === "win32" ? value.toLowerCase() : value;
    const homes = [path.resolve(app.getPath("home"), ".config", "clash"), path.resolve(app.getPath("exe"), "..", "data")];
    const grants = new Set();
    function homeDirectory(value) {
        if (typeof value !== "string" || !homes.some(home => normalize(home) === normalize(path.resolve(value)))) throw new Error("Invalid provider home");
        return fs.realpathSync(value);
    }
    function cacheFile(home, kind, hash) {
        if (!["proxy", "rule"].includes(kind) || typeof hash !== "string" || !/^[a-f\d]{32}$/.test(hash)) throw new Error("Invalid provider cache identity");
        const target = path.join(home, "providers", kind, `${hash}.yaml`);
        const folder = path.dirname(target);
        if (fs.existsSync(folder) && normalize(fs.realpathSync(folder)) !== normalize(folder)) throw new Error("Provider cache directory escapes its home");
        if (fs.existsSync(target) && normalize(fs.realpathSync(target)) !== normalize(target)) throw new Error("Provider cache escapes its directory");
        return target;
    }
    ipcMain.handle("provider-file", async (event, operation, request = {}) => {
        try {
            const window = getMainWindow();
            if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Invalid provider sender");
            const home = homeDirectory(request.home);
            if (operation === "find-cache" || operation === "reveal-cache") {
                const kind = ["proxy", "rule"].find(value => fs.existsSync(cacheFile(home, value, request.hash)));
                if (operation === "reveal-cache" && kind) shell.showItemInFolder(cacheFile(home, kind, request.hash));
                return { ok: true, value: kind || null };
            }
            if (!["read", "write", "open"].includes(operation) || !["proxy", "rule"].includes(request.kind) || typeof request.name !== "string") throw new Error("Invalid provider operation");
            const providers = getProviders()[`${request.kind}-providers`] || {};
            const provider = Object.hasOwn(providers, request.name) ? providers[request.name] : undefined;
            if (!provider || typeof provider.path !== "string") throw new Error("Unknown active provider");
            const target = path.resolve(home, provider.path);
            const relative = path.relative(home, target).replace(/\\/g, "/");
            const cached = new RegExp(`^providers/${request.kind}/[a-f\\d]{32}\\.yaml$`).test(relative);
            if (cached) cacheFile(home, request.kind, path.basename(target, ".yaml"));
            else {
                const real = fs.realpathSync(target);
                if (normalize(real) !== normalize(target) || !fs.statSync(real).isFile()) throw new Error("Invalid provider file");
                const grant = `${request.kind}\0${request.name}\0${normalize(real)}`;
                if (!grants.has(grant)) {
                    // File providers can point outside the cache. A native file selection grants
                    // this provider access without giving the renderer an arbitrary path API.
                    const selection = await dialog.showOpenDialog(window, {
                        title: "Select the configured provider file", defaultPath: real, properties: ["openFile"]
                    });
                    if (selection.canceled || selection.filePaths.length !== 1 || normalize(fs.realpathSync(selection.filePaths[0])) !== normalize(real)) throw new Error("Provider file was not selected");
                    grants.add(grant);
                }
                if (normalize(fs.realpathSync(target)) !== normalize(real)) throw new Error("Provider file changed");
            }
            let value;
            if (operation === "read") {
                value = readBoundedText({ fs, file: target });
            } else if (operation === "write") {
                if (typeof request.source !== "string" || Buffer.byteLength(request.source) > 33554432) throw new Error("Provider source is too large");
                writeAtomic({ fs, path, file: target, content: request.source });
            } else value = await shell.openPath(target);
            return { ok: true, value };
        } catch { return { ok: false, error: "Provider file operation failed" }; }
    });
}

module.exports = { registerProviderFileIpc };
