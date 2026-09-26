"use strict";

function registerApplicationIpc({ ipcMain, app, getMainWindow }) {
    ipcMain.handle("app", function(_event, operation, ...args) {
        switch (operation) {
            case "isPackaged":
                return app.isPackaged;
            case "getPath":
                return app.getPath(...args);
            case "getAppPath":
                return app.getAppPath();
            case "getName":
                return app.getName();
            case "getVersion":
                return app.getVersion();
            case "setLoginItemSettings":
                return app.setLoginItemSettings(...args);
            case "relaunch":
                return app.relaunch();
            case "exit": {
                const mainWindow = getMainWindow();
                if (mainWindow.isMaximized()) {
                    mainWindow.unmaximize();
                }
                return app.exit(...args);
            }
            case "quit":
                return app.quit();
        }
    });

    ipcMain.on("cleanup-done", function() {
        app.isQuiting = true;
        app.quit();
    });
}

module.exports = { registerApplicationIpc };
