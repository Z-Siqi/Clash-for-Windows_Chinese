"use strict";

const { installEditShortcuts } = require("./install-edit-shortcuts");

function createMainWindow({
    BrowserWindow,
    nativeTheme,
    path,
    dirname,
    staticRoot,
    isLinux,
    app,
    dialog,
    platform = process.platform,
    url,
    localize,
    onRelaunch
}) {
    const windowOptions = {
        height: 603,
        width: 850,
        minWidth: 850,
        minHeight: 603,
        backgroundColor: nativeTheme.shouldUseDarkColors ? "#272531" : "#f5f5f5",
        useContentSize: true,
        show: false,
        minimizable: true,
        frame: false,
        titleBarStyle: "hidden",
        webPreferences: {
            // The CommonJS renderer runs inside the isolated preload world.
            // No Node or generic IPC capability is exposed to the page main world.
            nodeIntegration: false,
            webSecurity: true,
            nodeIntegrationInWorker: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.resolve(path.join(dirname, "preload.js"))
        }
    };
    if (isLinux()) windowOptions.icon = path.join(staticRoot, "imgs", "icon_512.png");
    const mainWindow = new BrowserWindow(windowOptions);
    mainWindow.setMenu(null);
    installEditShortcuts(mainWindow.webContents, platform);
    mainWindow.webContents.on("will-navigate", function(event) {
        event.preventDefault();
    });
    mainWindow.loadURL(url, {
        userAgent: `ClashforWindows/${app.getVersion()}`
    });
    mainWindow.webContents.on("render-process-gone", async function(_event, details) {
        if (platform === "darwin" || details.reason !== "crashed") return;

        const result = await dialog.showMessageBox(mainWindow, {
            type: "error",
            title: "Clash for Windows",
            message: localize("Dashboard has crashed!", "仪表盘崩溃了!"),
            buttons: localize(["Reload", "Exit"], ["重新加载", "退出"])
        });
        if (result.response === 0) onRelaunch();
        else app.quit();
    });
    return mainWindow;
}

module.exports = { createMainWindow };
