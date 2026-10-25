"use strict";

const { createTranslator } = require("../../core/i18n/language");

function registerDialogIpc({ ipcMain, dialog, getMainWindow, getLanguage = () => createTranslator(1) }) {
    ipcMain.handle("dialog", function(_event, operation, ...args) {
        const mainWindow = getMainWindow();

        switch (operation) {
            case "showMessageBox":
                return dialog.showMessageBox(mainWindow, { buttons: [getLanguage().ok()], ...args[0] });
            case "showOpenDialogSync":
                return dialog.showOpenDialogSync(mainWindow, ...args);
        }
    });
}

module.exports = { registerDialogIpc };
