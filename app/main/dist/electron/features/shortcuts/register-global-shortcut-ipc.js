"use strict";

const { createShortcutBindings } = require("./shortcut-bindings");

function registerGlobalShortcutIpc({ ipcMain, globalShortcut, getMainWindow }) {
    const bindings = createShortcutBindings({ globalShortcut,
        onPressed: action => getMainWindow()?.webContents.send("shortcut-pressed", action) });
    ipcMain.handle("globalShortcut", function(_event, operation, ...args) {
        switch (operation) {
            case "bind": return bindings.bind(args[0], args[1]);
            case "capture": return bindings.capture(args[0]);
            case "register":
                return globalShortcut.register(args[0], function() {
                    getMainWindow().webContents.send("shortcut-pressed", args[0]);
                });
            case "unregister":
                return globalShortcut.unregister(...args);
            case "isRegistered":
                return globalShortcut.isRegistered(...args);
        }
    });
}

module.exports = { registerGlobalShortcutIpc };
