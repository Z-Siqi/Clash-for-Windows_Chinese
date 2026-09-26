"use strict";

function createShowMainWindow({
    getMainWindow,
    platform = process.platform,
    setTimeoutFn = setTimeout
}) {
    return function showMainWindow() {
        const mainWindow = getMainWindow();
        if (!mainWindow) return;

        if (platform === "win32") {
            if (mainWindow.isMinimized()) mainWindow.restore();
            else mainWindow.show();
            return;
        }

        mainWindow.setVisibleOnAllWorkspaces(true);
        setTimeoutFn(function() {
            mainWindow.show();
            mainWindow.setVisibleOnAllWorkspaces(false);
        }, 1);
    };
}

module.exports = { createShowMainWindow };
