"use strict";

const { installEditShortcuts } = require("./install-edit-shortcuts");
const { createTranslator } = require("../../core/i18n/language");

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
    getLanguage = () => createTranslator(1),
    onRelaunch,
    initializeRenderer
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
            // The browser renderer runs in the private world of a sandboxed preload.
            nodeIntegration: false,
            webSecurity: true,
            nodeIntegrationInWorker: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.resolve(path.join(dirname, "preload.js"))
        }
    };
    if (isLinux()) windowOptions.icon = path.join(staticRoot, "imgs", "icon_512.png");
    const mainWindow = new BrowserWindow(windowOptions);
    initializeRenderer?.(mainWindow);
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

        const labels = getLanguage();
        const result = await dialog.showMessageBox(mainWindow, {
            type: "error",
            title: "Clash for Windows",
            message: labels.dashboardCrashed(),
            buttons: [labels.reloadDashboard(), labels.exitApplication()]
        });
        if (result.response === 0) onRelaunch();
        else app.quit();
    });
    return mainWindow;
}

module.exports = { createMainWindow };
