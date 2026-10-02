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
const { registerNetworkInfoIpc } = require("../../features/network/register-network-info-ipc");
const { registerCoreLifecycleIpc } = require("../../features/clash-core/register-core-lifecycle-ipc");
const { createClashCoreRuntime } = require("../../features/clash-core/clash-core-runtime");
const { createClashServiceApi } = require("../../core/network/clash-service-api");
const { registerRepositoryIpc } = require("./register-repository-ipc");
const { registerClashApiIpc } = require("./register-clash-api-ipc");
const { registerCoreStreamIpc } = require("../../features/clash-core/register-core-stream-ipc");
const { registerUserScriptIpc } = require("../../features/scripts/register-user-script-ipc");
const { registerProfileDownloadIpc } = require("./register-profile-download-ipc");
const { registerUserProcessIpc } = require("../../features/scripts/register-user-process-ipc");
const { registerCoreLogIpc } = require("../../features/logs/register-core-log-ipc");
const { registerExternalEditorIpc } = require("../../features/settings/register-external-editor-ipc");
const { registerDhcpIpc } = require("../../features/router/register-dhcp-ipc");
const { registerApplicationLogIpc } = require("../../features/logs/register-application-log-ipc");
const { registerPortIpc } = require("../../features/network/register-port-ipc");
const { registerProviderFileIpc } = require("../../features/providers/register-provider-file-ipc");
const { registerPublicContentIpc } = require("../../features/network/register-public-content-ipc");
const { registerNavigationIpc } = require("../../features/navigation/register-navigation-ipc");

function registerCoreIpc({
    ipcMain,
    app,
    dialog,
    globalShortcut,
    nativeTheme,
    powerSaveBlocker,
    clipboard,
    shell,
    getMainWindow,
    clashApi,
    clashClientRegistry,
    staticRoot
}) {
    registerApplicationIpc({ ipcMain, app, getMainWindow, fs: require("fs"), path: require("path"), os: require("os") });
    registerWindowIpc({ ipcMain, getMainWindow });
    registerDialogIpc({ ipcMain, dialog, getMainWindow });
    registerGlobalShortcutIpc({ ipcMain, globalShortcut, getMainWindow });
    registerNativeThemeIpc({ ipcMain, nativeTheme, getMainWindow });
    registerPowerSaveIpc({ ipcMain, powerSaveBlocker });
    registerClipboardIpc({ ipcMain, clipboard, getMainWindow });
    registerRepositoryIpc({
        ipcMain, app, getMainWindow, fs: require("fs"), path: require("path"), yaml: require("yaml"),
        filesPath: staticRoot && (app.isPackaged ? require("path").join(staticRoot, "files") : require("path").resolve("static", "files")),
        getPort: require("get-port"), uuid: require("crypto").randomUUID, Koa: require("koa"), dialog, shell,
        got: require("got"), zlib: require("zlib"), tarStream: require("tar-stream")
    });
    registerNetworkInfoIpc({
        ipcMain, getMainWindow, platform: process.platform,
        networkInterfaces: require("os").networkInterfaces,
        execSync: require("child_process").execSync,
        isIP: require("net").isIP,
        isIPv4: require("net").isIPv4
    });
    if (clashApi && staticRoot) {
        registerNavigationIpc({ ipcMain, app, getMainWindow, fs: require("fs"), path: require("path"), shell });
        registerPublicContentIpc({ ipcMain, getMainWindow, axios: require("axios") });
        registerPortIpc({ ipcMain, getMainWindow, net: require("net"), getPort: require("get-port") });
        registerApplicationLogIpc({ ipcMain, getMainWindow, app, shell, fs: require("fs"), path: require("path"), logger: require("electron-log"), getSensitiveValues: () => [clashClientRegistry.getConnectionInfo()?.secret] });
        registerDhcpIpc({ ipcMain, app, getMainWindow, powerSaveBlocker, dhcp: require("dhcp"), networkInterfaces: require("os").networkInterfaces, isIPv4: require("net").isIPv4 });
        let appliedProviders = {};
        registerClashApiIpc({ ipcMain, getMainWindow, clashApi, onConfigApplied(config) {
            appliedProviders = {};
            try {
                const payload = require("yaml").parse(config.payload, { prettyErrors: false, strict: false });
                for (const kind of ["proxy-providers", "rule-providers"]) appliedProviders[kind] = payload?.[kind] || {};
            } catch { /* Failed or path-based configurations cannot grant provider file access. */ }
        } });
        registerProviderFileIpc({ ipcMain, app, getMainWindow, fs: require("fs"), path: require("path"), dialog, shell, getProviders: () => appliedProviders });
        registerCoreStreamIpc({ ipcMain, getMainWindow, getConnectionInfo: clashClientRegistry.getConnectionInfo, WebSocket: require("ws") });
        const fs = require("fs");
        const path = require("path");
        registerUserProcessIpc({ ipcMain, app, getMainWindow, fs, path, yaml: require("yaml"), childProcess: require("child_process") });
        registerExternalEditorIpc({ ipcMain, app, getMainWindow, fs, path, yaml: require("yaml"), childProcess: require("child_process") });
        registerProfileDownloadIpc({
            ipcMain, app, getMainWindow, fs, path, yaml: require("yaml"),
            Notification: require("electron").Notification,
            forkWorker: (...args) => require("electron").utilityProcess.fork(...args),
            workerPath: path.resolve(__dirname, "../utility/profile-worker.js")
        });
        registerUserScriptIpc({
            ipcMain, app, getMainWindow, fs, path, yaml: require("yaml"), dialog,
            Notification: require("electron").Notification, clashApi,
            forkWorker: (...args) => require("electron").utilityProcess.fork(...args),
            workerPath: path.resolve(__dirname, "../utility/script-worker.js")
        });
        const coreLifecycle = registerCoreLifecycleIpc({
            ipcMain, app, getMainWindow, clashApi, fs, path,
            filesPath: app.isPackaged ? path.join(staticRoot, "files") : path.resolve("static", "files"),
            platform: process.platform, arch: process.arch,
            runtime: createClashCoreRuntime({
                childProcess: require("child_process"), fs, path,
                serviceApi: createClashServiceApi({ client: require("axios") }),
                logger: require("electron-log")
            })
        });
        registerCoreLogIpc({ ipcMain, getMainWindow, getLogFile: coreLifecycle.getLogFile, readLastLines: require("read-last-lines"), path, shell });
    }
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
        axios: require("axios"),
        getPort: require("get-port"),
        shell
    });
}

module.exports = { registerCoreIpc };
