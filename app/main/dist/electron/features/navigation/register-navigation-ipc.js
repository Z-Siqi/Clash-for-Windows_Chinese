"use strict";

const { normalizeExternalUrl } = require("../../core/network/external-url-policy");

function registerNavigationIpc({ ipcMain, getMainWindow, app, fs, path, shell }) {
    function authorize(event) {
        const owner = getMainWindow()?.webContents;
        if (!owner || event.sender !== owner || event.senderFrame !== owner.mainFrame) throw new Error("Invalid navigation sender");
    }
    ipcMain.handle("external-navigation", (event, value) => {
        authorize(event);
        if (typeof value !== "string" || value.length > 8192) throw new Error("Invalid external URL");
        const url = normalizeExternalUrl(value, { allowLoopbackHttp: true });
        if (!url) throw new Error("Unsupported external URL");
        return shell.openExternal(url);
    });
    ipcMain.handle("application-folder", (event, kind, home) => {
        authorize(event);
        if (kind === "gui") return shell.showItemInFolder(app.getPath("userData"));
        const homes = [path.resolve(app.getPath("home"), ".config", "clash"), path.resolve(app.getPath("exe"), "..", "data")];
        if (kind !== "home" || typeof home !== "string" || !homes.some(value => path.resolve(home) === value) || !fs.statSync(home).isDirectory()) throw new Error("Unsupported application folder");
        return shell.openPath(fs.realpathSync(home));
    });
}

module.exports = { registerNavigationIpc };
