"use strict";

function registerClashClientInfo({ ipcMain, registry, getMainWindow }) {
    ipcMain.on("clash-core-info", function(event, info) {
        const window = getMainWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return;
        if (!info || !Number.isInteger(info.port) || info.port < 1 || info.port > 65535) return;
        if (info.secret !== undefined && typeof info.secret !== "string") return;
        registry.update(info);
    });
}

module.exports = { registerClashClientInfo };
