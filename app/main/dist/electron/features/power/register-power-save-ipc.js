"use strict";

function registerPowerSaveIpc({ ipcMain, powerSaveBlocker }) {
    ipcMain.handle("powerSaveBlocker", function(_event, operation, ...args) {
        switch (operation) {
            case "start":
                return powerSaveBlocker.start(...args);
            case "stop":
                return powerSaveBlocker.stop(...args);
        }
    });
}

module.exports = { registerPowerSaveIpc };
