"use strict";

function registerTrayStatusIpc({ ipcMain, trayIconController }) {
    ipcMain.on("status-changed", function(_event, image) {
        trayIconController.update(image);
    });
}

module.exports = { registerTrayStatusIpc };
