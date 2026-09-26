"use strict";

function registerClashClientInfo({ ipcMain, registry }) {
    ipcMain.on("clash-core-info", function(_event, info) {
        registry.update(info);
    });
}

module.exports = { registerClashClientInfo };
