"use strict";

function registerWindowControlIpc({ ipcMain, app, getMainWindow, showMainWindow }) {
    ipcMain.handle("window-control", function(_event, operation) {
        switch (operation) {
            case "hide":
                app.quit();
                break;
            case "show":
                showMainWindow();
                break;
            case "show-or-hide":
                if (getMainWindow().isVisible() && getMainWindow().isFocused()) {
                    app.quit();
                } else {
                    showMainWindow();
                }
                // Showing must not fall through to the close path (issue #292).
                break;
            default:
                app.quit();
        }
    });
}

module.exports = { registerWindowControlIpc };
