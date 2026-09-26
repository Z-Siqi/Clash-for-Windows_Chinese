"use strict";

function registerShutdownHandler({
    powerMonitor,
    app,
    getMainWindow,
    setTimeoutFn = setTimeout
}) {
    powerMonitor.on("shutdown", function(event) {
        event.preventDefault();
        getMainWindow().webContents.send("app-exit");
        setTimeoutFn(function() {
            const mainWindow = getMainWindow();
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            }
            app.isQuiting = true;
            app.quit();
        }, 5000);
    });
}

module.exports = { registerShutdownHandler };
