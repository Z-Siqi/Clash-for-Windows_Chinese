"use strict";

const {
    registerApplicationIpc
} = require("../../features/application/register-application-ipc");
const { registerWindowIpc } = require("../../features/window/register-window-ipc");
const { registerDialogIpc } = require("../../features/dialog/register-dialog-ipc");
const {
    registerGlobalShortcutIpc
} = require("../../features/shortcuts/register-global-shortcut-ipc");
const {
    registerNativeThemeIpc
} = require("../../features/theme/register-native-theme-ipc");
const { registerPowerSaveIpc } = require("../../features/power/register-power-save-ipc");
const { registerClipboardIpc } = require("../../features/application/register-clipboard-ipc");
const { registerNativeAdminIpc } = require("./register-native-admin-ipc");
const { createSudoPromptCompat } = require("../../core/native/sudo-prompt-compat");

function registerCoreIpc({
    ipcMain,
    app,
    dialog,
    globalShortcut,
    nativeTheme,
    powerSaveBlocker,
    clipboard,
    getMainWindow
}) {
    registerApplicationIpc({ ipcMain, app, getMainWindow });
    registerWindowIpc({ ipcMain, getMainWindow });
    registerDialogIpc({ ipcMain, dialog, getMainWindow });
    registerGlobalShortcutIpc({ ipcMain, globalShortcut, getMainWindow });
    registerNativeThemeIpc({ ipcMain, nativeTheme, getMainWindow });
    registerPowerSaveIpc({ ipcMain, powerSaveBlocker });
    registerClipboardIpc({ ipcMain, clipboard, getMainWindow });
    registerNativeAdminIpc({
        ipcMain,
        app,
        getMainWindow,
        fs: require("fs"),
        path: require("path"),
        crypto: require("crypto"),
        childProcess: require("child_process"),
        sudoPrompt: createSudoPromptCompat({
            sudoPrompt: require("@vscode/sudo-prompt"),
            util: require("util")
        }),
        axios: require("axios")
    });
}

module.exports = { registerCoreIpc };
