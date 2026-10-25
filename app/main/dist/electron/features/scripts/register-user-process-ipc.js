"use strict";

function registerUserProcessIpc({ ipcMain, app, getMainWindow, fs, path, yaml, childProcess, platform = process.platform }) {
    const homes = [path.resolve(app.getPath("home"), ".config", "clash"), path.resolve(app.getPath("exe"), "..", "data")];
    const normalize = value => platform === "win32" ? value.toLowerCase() : value;
    const owned = new Set();
    let started = false;
    app.once("will-quit", () => { for (const child of owned) { try { child.kill(); } catch (_error) {} } owned.clear(); });
    ipcMain.handle("user-processes-start", (event, home) => {
        const window = getMainWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Invalid user process sender");
        if (typeof home !== "string" || !homes.some(value => normalize(value) === normalize(path.resolve(home)))) throw new Error("Unsupported user process home");
        if (started) return owned.size;
        const folder = fs.realpathSync(home);
        const settingsFile = path.join(folder, "cfw-settings.yaml");
        if (fs.existsSync(settingsFile) && normalize(path.dirname(fs.realpathSync(settingsFile))) !== normalize(folder)) throw new Error("User process settings escape their home");
        let processes;
        try {
            const settings = yaml.parse(fs.readFileSync(settingsFile, "utf8")) || {};
            processes = yaml.parse(settings.childProcessText || "")?.processes || [];
        } catch (_error) { return 0; }
        if (!Array.isArray(processes) || processes.length > 32) throw new Error("Invalid saved user process list");
        started = true;
        // Commands belong to the user's persisted process list, never an IPC argument.
        for (const config of processes) {
            if (typeof config?.command !== "string" || !config.command || (config.args && (!Array.isArray(config.args) || !config.args.every(arg => typeof arg === "string")))) continue;
            try {
                const options = config.options || {};
                const child = childProcess.spawn(config.command, config.args || [], { ...options, windowsHide: true });
                owned.add(child);
                child.once("exit", () => owned.delete(child));
                child.on("error", () => owned.delete(child));
                if (config.log && typeof options.cwd === "string") {
                    for (const [stream, name] of [[child.stdout, "cfw-child-process-out.log"], [child.stderr, "cfw-child-process-err.log"]]) {
                        if (!stream) continue;
                        const file = path.join(options.cwd, name);
                        if (fs.existsSync(file) && normalize(path.dirname(fs.realpathSync(file))) !== normalize(fs.realpathSync(options.cwd))) continue;
                        const output = fs.createWriteStream(file, { flags: "a" });
                        output.on("error", () => {});
                        stream.pipe(output);
                    }
                }
            } catch (_error) { /* One invalid saved command must not prevent the other processes. */ }
        }
        return owned.size;
    });
}

module.exports = { registerUserProcessIpc };
