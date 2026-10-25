"use strict";

const { supportsWindowPin } = require("./pin-policy");

function registerWindowIpc({ ipcMain, getMainWindow, app, platform = process.platform, env = process.env }) {
    const pinSupported = supportsWindowPin({ platform, env,
        ozonePlatform: app?.commandLine?.getSwitchValue("ozone-platform") || "" });
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
                if (typeof args[0] !== "boolean" || args.length !== 1) throw new Error("Invalid window pin request");
                if (!pinSupported) return false;
                mainWindow.setAlwaysOnTop(args[0]);
                return mainWindow.isAlwaysOnTop();
            case "getPinState":
                return { supported: pinSupported, pinned: pinSupported && mainWindow.isAlwaysOnTop() };
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
