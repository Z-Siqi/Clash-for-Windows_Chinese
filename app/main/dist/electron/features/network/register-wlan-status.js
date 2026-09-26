"use strict";

function registerWlanStatus({ ipcMain, networkChangeMonitor, getMainWindow }) {
    let unsubscribe = null;
    ipcMain.handle("wlan-status-wanted", function() {
        const mainWindow = getMainWindow();
        if (!mainWindow) return;
        if (unsubscribe) return;

        try {
            unsubscribe = networkChangeMonitor.subscribe(function(error, status) {
                if (error) {
                    mainWindow.webContents.send(
                        "wlan-status-listen-error",
                        JSON.stringify(error)
                    );
                } else {
                    mainWindow.webContents.send("wlan-status-changed", status);
                }
            });
        } catch (error) {
            mainWindow.webContents.send("wlan-status-listen-error", error.message);
        }
    });

    return function stop() {
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
        networkChangeMonitor.stop();
    };
}

module.exports = { registerWlanStatus };
