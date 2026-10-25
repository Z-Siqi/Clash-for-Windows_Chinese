"use strict";

function registerApplicationLogIpc({ ipcMain, getMainWindow, app, fs, path, shell, logger, getSensitiveValues = () => [] }) {
    logger.transports.console.format = message => message.data;
    logger.transports.file.format = message => `time="${message.date}" level=${message.level} msg="${message.data}"`;
    function authorize(event) {
        const owner = getMainWindow()?.webContents;
        if (!owner || event.sender !== owner || event.senderFrame !== owner.mainFrame) throw new Error("Invalid application log sender");
    }
    let windowStarted = 0, count = 0;
    ipcMain.on?.("application-log-write", (event, level, messages) => {
        try { authorize(event); } catch { return; }
        if (!["info", "warn", "error"].includes(level) || !Array.isArray(messages) || messages.length > 8 || messages.some(message => typeof message !== "string" || message.length > 8192)) return;
        if (Date.now() - windowStarted > 1000) { windowStarted = Date.now(); count = 0; }
        if (++count > 256) return;
        const sensitive = getSensitiveValues().filter(value => typeof value === "string" && value.length > 0);
        logger[level](...messages.map(message => sensitive.reduce((text, value) => text.split(value).join("<redacted>"), message)));
    });
    ipcMain.handle("application-log-open", async (event, kind) => {
        authorize(event);
        if (kind === "gui") return shell.openPath(path.dirname(logger.transports.file.getFile().path));
        if (!["parser", "script"].includes(kind)) throw new Error("Unsupported application log");
        const root = fs.realpathSync(app.getPath("temp"));
        const target = path.join(root, `cfw-${kind}.log`);
        try { fs.writeFileSync(target, "", { flag: "wx", mode: 0o600 }); }
        catch (error) { if (error.code !== "EEXIST") throw error; }
        if (fs.lstatSync(target).isSymbolicLink() || fs.realpathSync(target) !== target || !fs.statSync(target).isFile()) throw new Error("Invalid application log file");
        return shell.openPath(target);
    });
}

module.exports = { registerApplicationLogIpc };
