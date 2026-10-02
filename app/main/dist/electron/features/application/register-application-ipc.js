"use strict";

const { createLoginItemRuntime } = require("./set-auto-launch");

function registerApplicationIpc({ ipcMain, app, getMainWindow, fs, path, os, platform = process.platform }) {
    const setLoginItems = createLoginItemRuntime({ app, fs, path, platform });
    function authorize(event) {
        const window = getMainWindow();
        if (!window || event?.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Invalid application IPC sender");
    }
    ipcMain.handle("app", function(event, operation, ...args) {
        authorize(event);
        switch (operation) {
            case "getRuntimeInfo":
                return { platform: process.platform, arch: process.arch, release: os.release(), portableDataExists: fs.existsSync(path.join(path.dirname(app.getPath("exe")), "data")) };
            case "isPackaged":
                return app.isPackaged;
            case "getPath":
                if (!["home", "exe", "temp", "userData", "appData", "logs", "downloads", "documents"].includes(args[0])) throw new Error("Unsupported application path");
                return app.getPath(...args);
            case "getAppPath":
                return app.getAppPath();
            case "getName":
                return app.getName();
            case "getVersion":
                return app.getVersion();
            case "setLoginItemSettings":
                if (typeof args[0]?.openAtLogin !== "boolean") throw new Error("Invalid login setting");
                return setLoginItems(args[0].openAtLogin);
            case "relaunch":
                return app.relaunch();
            case "exit": {
                if (!Number.isInteger(args[0]) || args[0] < 0 || args[0] > 255) throw new Error("Invalid application exit code");
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

    ipcMain.on("cleanup-done", function(event) {
        authorize(event);
        app.isQuiting = true;
        app.quit();
    });
}

module.exports = { registerApplicationIpc };
