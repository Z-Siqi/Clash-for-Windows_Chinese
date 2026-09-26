"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const electron = require("electron");
const windowBounds = require("electron-window-bounds");

const fixShellPath = require("./features/application/fix-shell-path");
const { installApplicationMenu } = require("./features/application/install-application-menu");
const { registerAppLifecycle } = require("./features/application/register-app-lifecycle");
const { registerDownloadIpc } = require("./features/download/register-download-ipc");
const { installTouchBar } = require("./features/navigation/install-touch-bar");
const { createNetworkChangeMonitor } = require("./features/network/network-change-monitor");
const { registerWlanStatus } = require("./features/network/register-wlan-status");
const { registerNotificationIpc } = require("./features/notifications/register-notification-ipc");
const { registerPowerMonitor } = require("./features/power/register-power-monitor");
const { registerShutdownHandler } = require("./features/power/register-shutdown-handler");
const { createUnsafeUrlPolicy } = require("./features/security/unsafe-url-policy");
const { createContextMenuBuilder } = require("./features/tray/build-context-menu");
const { buildStaticTrayMenu } = require("./features/tray/build-static-tray-menu");
const { registerSpeedIndicator } = require("./features/tray/register-speed-indicator");
const { registerTrayStatusIpc } = require("./features/tray/register-tray-status-ipc");
const { createTrayIconController } = require("./features/tray/tray-icon-controller");
const { createTrayLifecycle } = require("./features/tray/tray-lifecycle");
const { createTrayState, registerTrayStateIpc } = require("./features/tray/tray-state");
const { createMainWindow: createMainWindowShell } = require("./features/window/create-main-window");
const { registerMainWindowLifecycle } = require("./features/window/register-main-window-lifecycle");
const { registerWindowControlIpc } = require("./features/window/register-window-control-ipc");
const { createWindowBoundsNormalizer } = require("./features/window/normalize-window-bounds");
const { createShowMainWindow } = require("./features/window/show-main-window");
const { createClashApi } = require("./core/network/clash-api");
const { createClashClientRegistry } = require("./core/network/clash-client-registry");
const { registerClashClientInfo } = require("./entry/main/register-clash-client-info");
const { registerCoreIpc } = require("./entry/main/register-core-ipc");

function selectLanguage(language, chinese, english) {
    return language === 0 ? chinese : english;
}

function startApplication() {
    let mainWindow;
    let tray;
    let trayState;

    const packagedStaticRoot = path.join(process.resourcesPath, "static");
    const staticRoot = (fs.existsSync(packagedStaticRoot)
        ? packagedStaticRoot
        : path.join(__dirname, "static")).replace(/\\/g, "\\\\");
    const dashboardUrl = `file://${__dirname}/index.html`;
    const isLinux = () => process.platform === "linux";

    global.__static = staticRoot;
    fixShellPath();
    electron.app.disableHardwareAcceleration();
    electron.app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");
    if (process.platform === "darwin") electron.app.dock.hide();

    const unsafeUrlPolicy = createUnsafeUrlPolicy({ ipcMain: electron.ipcMain });
    const clashClientRegistry = createClashClientRegistry({ axios });
    const clashApi = createClashApi({ getClient: clashClientRegistry.getClient });
    const showMainWindow = createShowMainWindow({ getMainWindow: () => mainWindow });
    const normalizeWindowBounds = createWindowBoundsNormalizer({ screen: electron.screen });
    const trayIconController = createTrayIconController({
        nativeImage: electron.nativeImage
    });

    registerClashClientInfo({
        ipcMain: electron.ipcMain,
        registry: clashClientRegistry
    });
    const stopNetworkChangeMonitor = registerWlanStatus({
        ipcMain: electron.ipcMain,
        networkChangeMonitor: createNetworkChangeMonitor({
            networkInterfaces: os.networkInterfaces
        }),
        getMainWindow: () => mainWindow
    });
    electron.app.once("will-quit", stopNetworkChangeMonitor);

    function localize(english, chinese) {
        return selectLanguage(trayState.language, chinese, english);
    }

    function relaunchApplication() {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        electron.app.relaunch();
        electron.app.exit(0);
    }

    function createApplicationWindow() {
        mainWindow = createMainWindowShell({
            BrowserWindow: electron.BrowserWindow,
            nativeTheme: electron.nativeTheme,
            path,
            dirname: __dirname,
            staticRoot,
            isLinux,
            app: electron.app,
            dialog: electron.dialog,
            url: dashboardUrl,
            localize,
            onRelaunch: relaunchApplication
        });

        registerDownloadIpc({
            ipcMain: electron.ipcMain,
            getMainWindow: () => mainWindow
        });
        registerCoreIpc({
            ipcMain: electron.ipcMain,
            app: electron.app,
            dialog: electron.dialog,
            globalShortcut: electron.globalShortcut,
            nativeTheme: electron.nativeTheme,
            powerSaveBlocker: electron.powerSaveBlocker,
            clipboard: electron.clipboard,
            getMainWindow: () => mainWindow
        });
        registerMainWindowLifecycle({
            mainWindow,
            app: electron.app,
            globalShortcut: electron.globalShortcut,
            getTray: () => tray
        });
        installTouchBar({
            mainWindow,
            TouchBar: electron.TouchBar,
            TouchBarButton: electron.TouchBar.TouchBarButton
        });
        registerPowerMonitor({
            powerMonitor: electron.powerMonitor,
            getMainWindow: () => mainWindow
        });
        registerWindowControlIpc({
            ipcMain: electron.ipcMain,
            app: electron.app,
            getMainWindow: () => mainWindow,
            showMainWindow
        });
        registerTrayStatusIpc({
            ipcMain: electron.ipcMain,
            trayIconController
        });
        registerNotificationIpc({
            ipcMain: electron.ipcMain,
            Notification: electron.Notification,
            nativeImage: electron.nativeImage,
            shell: electron.shell,
            path,
            staticRoot
        });

        trayState = createTrayState();
        const trayActions = {
            showDashboard: showMainWindow,
            sendRenderer(channel, ...args) {
                return mainWindow.webContents.send(channel, ...args);
            },
            runTrayScript() {
                return mainWindow.webContents.send("run-tray-script");
            },
            toggleDevTools() {
                mainWindow.webContents.toggleDevTools();
            },
            moveToNearestMonitor() {
                mainWindow.setBounds(normalizeWindowBounds(mainWindow.getBounds()));
                showMainWindow();
            },
            restart: relaunchApplication,
            forceQuit() {
                electron.app.isQuiting = true;
                electron.app.quit();
            },
            requestQuit() {
                if (mainWindow.isMaximized()) mainWindow.unmaximize();
                return mainWindow.webContents.send("app-exit");
            }
        };
        const buildTrayContextMenu = createContextMenuBuilder({
            state: trayState,
            isLinux,
            clashApi,
            nativeImage: electron.nativeImage,
            path,
            staticRoot,
            localize,
            actions: trayActions
        });
        const trayLifecycle = createTrayLifecycle({
            ipcMain: electron.ipcMain,
            Tray: electron.Tray,
            Menu: electron.Menu,
            nativeImage: electron.nativeImage,
            path,
            staticRoot,
            buildContextMenu: buildTrayContextMenu,
            showMainWindow,
            onTrayChanged(value) {
                tray = value;
                trayIconController.setTray(value);
            }
        });
        trayLifecycle.create();

        const chineseTrayMenu = buildStaticTrayMenu({
            Menu: electron.Menu,
            locale: "cn",
            state: trayState,
            actions: trayActions
        });
        const englishTrayMenu = buildStaticTrayMenu({
            Menu: electron.Menu,
            locale: "en",
            state: trayState,
            actions: trayActions
        });
        const refreshLinuxTrayMenu = () => {
            if (isLinux() && tray) tray.setContextMenu(localize(englishTrayMenu, chineseTrayMenu));
        };

        refreshLinuxTrayMenu();
        registerTrayStateIpc({
            ipcMain: electron.ipcMain,
            state: trayState,
            isLinux,
            getLocalizedMenu: () => localize(englishTrayMenu, chineseTrayMenu),
            getMenus: () => [englishTrayMenu, chineseTrayMenu],
            refreshMenu: refreshLinuxTrayMenu,
            showMainWindow
        });
        registerSpeedIndicator({
            ipcMain: electron.ipcMain,
            BrowserWindow: electron.BrowserWindow,
            nativeImage: electron.nativeImage,
            app: electron.app,
            fs,
            path,
            staticRoot,
            preloadPath: path.join(__dirname, "entry", "preload", "speed-indicator.js"),
            getTray: () => tray
        });
        installApplicationMenu({
            Menu: electron.Menu,
            app: electron.app,
            shell: electron.shell,
            requestQuit: trayActions.requestQuit
        });
    }

    registerAppLifecycle({
        app: electron.app,
        dialog: electron.dialog,
        getMainWindow: () => mainWindow,
        createMainWindow: createApplicationWindow,
        showMainWindow,
        initializeLogging: windowBounds.init,
        registerShutdown() {
            registerShutdownHandler({
                powerMonitor: electron.powerMonitor,
                app: electron.app,
                getMainWindow: () => mainWindow
            });
        },
        unsafeUrlPolicy
    });
}

startApplication();

module.exports = { startApplication };
