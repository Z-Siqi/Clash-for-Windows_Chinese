"use strict";

const MAX_CLIPBOARD_TEXT_LENGTH = 16 * 1024 * 1024;

function registerClipboardIpc({ ipcMain, clipboard, getMainWindow }) {
    ipcMain.handle("clipboard", async function(event, operation, value) {
        const mainWindow = getMainWindow();
        if (!mainWindow || event.sender !== mainWindow.webContents) {
            throw new Error("Clipboard request did not originate from the main window");
        }
        if (operation === "readText") {
            return clipboard.readText();
        }
        if (operation === "writeText" && typeof value === "string"
            && value.length <= MAX_CLIPBOARD_TEXT_LENGTH) {
            await clipboard.writeText(value);
            return true;
        }
        throw new Error("Unsupported clipboard operation");
    });
}

module.exports = { MAX_CLIPBOARD_TEXT_LENGTH, registerClipboardIpc };
