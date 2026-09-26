"use strict";

function registerNativeThemeIpc({ ipcMain, nativeTheme, getMainWindow }) {
    ipcMain.handle("nativeTheme", function(_event, operation) {
        if (operation === "shouldUseDarkColors") {
            return nativeTheme.shouldUseDarkColors;
        }
    });

    nativeTheme.on("updated", function() {
        getMainWindow().webContents.send(
            "native-theme-updated",
            nativeTheme.shouldUseDarkColors
        );
    });
}

module.exports = { registerNativeThemeIpc };
