"use strict";

function registerDialogIpc({ ipcMain, dialog, getMainWindow }) {
    ipcMain.handle("dialog", function(_event, operation, ...args) {
        const mainWindow = getMainWindow();

        switch (operation) {
            case "showMessageBox":
                return dialog.showMessageBox(mainWindow, ...args);
            case "showOpenDialogSync":
                return dialog.showOpenDialogSync(mainWindow, ...args);
        }
    });
}

module.exports = { registerDialogIpc };
