"use strict";

function registerCoreLogIpc({ ipcMain, getMainWindow, getLogFile, readLastLines, path, shell }) {
    ipcMain.handle("core-log-open", (event, folder = false) => {
        const owner = getMainWindow()?.webContents;
        if (!owner || event.sender !== owner || event.senderFrame !== owner.mainFrame || typeof folder !== "boolean") throw new Error("Invalid core log request");
        const file = getLogFile();
        if (!file) return;
        return folder ? shell.openPath(path.dirname(file)) : shell.showItemInFolder(file);
    });
    ipcMain.handle("core-log-read", async (event, lineCount = 1000) => {
        const window = getMainWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Invalid core log sender");
        if (!Number.isInteger(lineCount) || lineCount < 0 || lineCount > 100000) throw new Error("Invalid core log line count");
        const file = getLogFile();
        if (!file || lineCount === 0) return "";
        try { return (await readLastLines.read(file, lineCount)).slice(-1048576); }
        catch (_error) { throw new Error("Core log read failed"); }
    });
}

module.exports = { registerCoreLogIpc };
