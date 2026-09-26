"use strict";

function registerMainWindowLifecycle({
    mainWindow,
    app,
    globalShortcut,
    getTray,
    platform = process.platform
}) {
    mainWindow.on("hide", function() {
        sendWindowEvent("hide");
    });
    mainWindow.on("show", function() {
        if (platform === "darwin") {
            app.dock.show();
        }
        sendWindowEvent("show");
    });
    mainWindow.on("close", function(event) {
        if (app.isQuiting) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            }
            globalShortcut.unregisterAll();
            app.exit();
        } else {
            event.preventDefault();
            if (platform === "darwin" && mainWindow.isFullScreen()) {
                mainWindow.setFullScreen(false);
                return;
            }
            sendWindowEvent("close");
            if (getTray()) {
                mainWindow.blur();
                mainWindow.hide();
                if (platform === "darwin") {
                    app.dock.hide();
                }
            } else {
                mainWindow.minimize();
            }
        }
        return false;
    });
    mainWindow.on("maximize", function() {
        sendWindowEvent("maximize");
    });
    mainWindow.on("unmaximize", function() {
        sendWindowEvent("unmaximize");
    });
    mainWindow.on("enter-full-screen", function() {
        sendWindowEvent("enter-full-screen");
    });
    mainWindow.on("leave-full-screen", function() {
        sendWindowEvent("leave-full-screen");
    });
    mainWindow.on("session-end", function(event) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        event.preventDefault();
        mainWindow.webContents.send("app-exit");
    });

    function sendWindowEvent(eventName) {
        mainWindow.webContents.send("window-event", eventName);
    }
}

module.exports = { registerMainWindowLifecycle };
