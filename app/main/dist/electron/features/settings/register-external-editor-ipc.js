"use strict";

const { createSettingsRepository } = require("./settings-repository");
const { readBoundedText } = require("../../core/storage/read-bounded-text");

function splitEditorCommand(source) {
    if (typeof source !== "string" || !source.trim() || source.length > 4096 || /[\r\n\0]/.test(source)) throw new Error("Invalid external editor command");
    const args = [];
    let quote = ""; let token = ""; let started = false;
    for (let index = 0; index < source.length; index++) {
        const character = source[index];
        if (quote) {
            if (character === quote) quote = "";
            else if (character === "\\" && source[index + 1] === quote) token += source[++index];
            else token += character;
        } else if (character === '"' || character === "'") { quote = character; started = true; }
        else if (/\s/.test(character)) {
            if (started) { args.push(token); token = ""; started = false; }
        } else { token += character; started = true; }
    }
    if (quote) throw new Error("Unclosed external editor quote");
    if (started) args.push(token);
    if (!args[0]) throw new Error("External editor executable is missing");
    return args;
}

function resolveEditorLaunch({ command, platform, path, fs, environment }) {
    const args = splitEditorCommand(command);
    const name = path.basename(args[0]).toLowerCase();
    // Windows code.cmd launches a Node CLI; use its installed executable directly, without a shell.
    if (platform === "win32" && ["code", "code.cmd"].includes(name)) {
        const directories = path.isAbsolute(args[0]) ? [path.dirname(args[0])] : (environment.PATH || environment.Path || "").split(path.delimiter);
        for (const directory of directories) {
            if (!directory) continue;
            const root = path.resolve(directory, "..");
            const executable = path.join(root, "Code.exe");
            const cli = path.join(root, "resources", "app", "out", "cli.js");
            if (fs.existsSync(path.join(directory, "code.cmd")) && fs.existsSync(executable) && fs.existsSync(cli)) {
                return { executable, args: [cli, ...args.slice(1)], env: { ...environment, ELECTRON_RUN_AS_NODE: "1" } };
            }
        }
    }
    return { executable: args[0], args: args.slice(1), env: environment };
}

function registerExternalEditorIpc({ ipcMain, app, getMainWindow, fs, path, yaml, childProcess, platform = process.platform, environment = process.env }) {
    const homes = [path.resolve(app.getPath("home"), ".config", "clash"), path.resolve(app.getPath("exe"), "..", "data")];
    const normalize = value => platform === "win32" ? value.toLowerCase() : value;
    const jobs = new Map();
    const registeredSenders = new WeakSet();
    const extensions = { yaml: "yml", javascript: "js", json: "json", plaintext: "txt" };
    ipcMain.handle("external-editor", (event, action, request = {}) => {
        const window = getMainWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Invalid external editor sender");
        if (action === "cancel") { jobs.get(event.sender)?.cancel(); return; }
        if (action !== "edit" || typeof request.home !== "string" || !homes.some(home => normalize(home) === normalize(path.resolve(request.home)))) throw new Error("Unsupported external editor request");
        if (!Object.hasOwn(extensions, request.language) || typeof request.content !== "string" || request.content.length > 33554432) throw new Error("Invalid external editor content");
        const home = fs.realpathSync(request.home);
        const settingsFile = path.join(home, "cfw-settings.yaml");
        if (fs.existsSync(settingsFile) && normalize(path.dirname(fs.realpathSync(settingsFile))) !== normalize(home)) throw new Error("External editor settings escape their home");
        const settings = createSettingsRepository({ fs, path, yaml }).load(home);
        const editor = Number(settings.editor);
        if (![1, 2].includes(editor)) throw new Error("External editor is not enabled");
        const launch = resolveEditorLaunch({ command: editor === 1 ? "code --wait" : settings.editorCustomCommand || "subl --wait", platform, path, fs, environment });
        jobs.get(event.sender)?.cancel();
        const directory = fs.mkdtempSync(path.join(app.getPath("temp"), "cfw-external-editor-"));
        const target = path.join(directory, `close-to-save.${extensions[request.language]}`);
        try { fs.writeFileSync(target, request.content, { flag: "wx", mode: 0o600 }); }
        catch (_error) {
            try { fs.rmSync(directory, { recursive: true, force: true }); } catch (_cleanupError) {}
            throw new Error("External editor temporary file could not be created");
        }
        return new Promise((resolve, reject) => {
            let child; let settled = false;
            function finish(error) {
                if (settled) return;
                settled = true; jobs.delete(event.sender);
                try {
                    if (error) throw error;
                    if (normalize(path.dirname(fs.realpathSync(target))) !== normalize(fs.realpathSync(directory))) throw new Error("Invalid editor output");
                    resolve(readBoundedText({ fs, file: target }));
                } catch (_error) { reject(new Error("External editor failed or was cancelled")); }
                finally {
                    try { child?.kill(); } catch (_error) {}
                    try { fs.rmSync(directory, { recursive: true, force: true }); } catch (_error) {}
                }
            }
            jobs.set(event.sender, { cancel: () => finish(new Error("Editor cancelled")) });
            if (!registeredSenders.has(event.sender)) {
                registeredSenders.add(event.sender);
                event.sender.once("destroyed", () => jobs.get(event.sender)?.cancel());
                event.sender.on("did-start-loading", () => jobs.get(event.sender)?.cancel());
            }
            try {
                child = childProcess.spawn(launch.executable, [...launch.args, target], { shell: false, windowsHide: true, stdio: "ignore", env: launch.env });
                child.once("error", () => finish(new Error("Editor failed")));
                child.once("exit", code => finish(code === 0 ? null : new Error("Editor failed")));
            } catch (_error) { finish(new Error("Editor failed")); }
        });
    });
    app.once("will-quit", () => { for (const job of [...jobs.values()]) job.cancel(); });
}

module.exports = { registerExternalEditorIpc, resolveEditorLaunch, splitEditorCommand };
