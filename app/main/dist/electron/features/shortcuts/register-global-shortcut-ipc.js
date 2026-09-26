"use strict";

function registerGlobalShortcutIpc({ ipcMain, globalShortcut, getMainWindow }) {
    ipcMain.handle("globalShortcut", function(_event, operation, ...args) {
        switch (operation) {
            case "register":
                return globalShortcut.register(args[0], function() {
                    getMainWindow().webContents.send("shortcut-pressed", args[0]);
                });
            case "unregister":
                return globalShortcut.unregister(...args);
            case "isRegistered":
                return globalShortcut.isRegistered(...args);
        }
    });
}

module.exports = { registerGlobalShortcutIpc };
