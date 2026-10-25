"use strict";

// Filter old semantic channels at their composition boundary as well as in
// individual handlers. The tray indicator receives only its fixed Show action.
function createAuthorizedIpcMain({ ipcMain, getMainWindow, getIndicatorWindow = () => null }) {
    function authorized(event, channel, args) {
        const owner = getMainWindow()?.webContents;
        if (owner && event?.sender === owner && event.senderFrame === owner.mainFrame) return true;
        const indicator = getIndicatorWindow()?.webContents;
        return channel === "window-control" && args.length === 1 && args[0] === "show"
            && indicator && event?.sender === indicator && event.senderFrame === indicator.mainFrame;
    }
    return {
        handle(channel, handler) {
            ipcMain.handle(channel, (event, ...args) => {
                if (!authorized(event, channel, args)) throw new Error("Unauthorized application IPC sender");
                return handler(event, ...args);
            });
        },
        on(channel, handler) {
            ipcMain.on(channel, (event, ...args) => {
                if (authorized(event, channel, args)) return handler(event, ...args);
            });
        }
    };
}

module.exports = { createAuthorizedIpcMain };
