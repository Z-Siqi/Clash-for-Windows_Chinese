"use strict";

function registerWindowIpc({ ipcMain, getMainWindow }) {
    ipcMain.handle("window", function(_event, operation, ...args) {
        const mainWindow = getMainWindow();

        switch (operation) {
            case "close":
                return mainWindow.close();
            case "minimize":
                return mainWindow.minimize();
            case "maximize":
                return mainWindow.maximize();
            case "unmaximize":
                return mainWindow.unmaximize();
            case "setAlwaysOnTop":
                return mainWindow.setAlwaysOnTop(...args);
            case "isVisible":
                return mainWindow.isVisible();
            case "isMaximized":
                return mainWindow.isMaximized();
            case "setFullScreen":
                return mainWindow.setFullScreen(...args);
            case "reload":
                return mainWindow.reload();
        }
    });

    ipcMain.handle("webContent", function(_event, operation) {
        if (operation === "toggleDevTools") {
            return getMainWindow().webContents.toggleDevTools();
        }
    });
}

module.exports = { registerWindowIpc };
