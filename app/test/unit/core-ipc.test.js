"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const mainPath = path.join(root, "app/main/dist/electron/main.js");
const featureRoot = path.join(root, "app/main/dist/electron/features");
const { registerCoreIpc } = require(path.join(
    root,
    "app/main/dist/electron/entry/main/register-core-ipc"
));
const {
    registerDownloadIpc
} = require(path.join(featureRoot, "download/register-download-ipc"));
const {
    registerMainWindowLifecycle
} = require(path.join(featureRoot, "window/register-main-window-lifecycle"));

async function main() {
    const handlers = new Map();
    const ipcListeners = new Map();
    const themeListeners = new Map();
    const sessionListeners = new Map();
    const windowListeners = new Map();
    const calls = [];
    const sent = [];
    let shortcutCallback;

    const ipcMain = {
        handle(channel, handler) {
            assert.equal(handlers.has(channel), false, `duplicate IPC handler: ${channel}`);
            handlers.set(channel, handler);
        },
        on(channel, listener) {
            assert.equal(ipcListeners.has(channel), false, `duplicate IPC listener: ${channel}`);
            ipcListeners.set(channel, listener);
        }
    };

    let maximized = true;
    const mainWindow = {
        on(event, callback) {
            windowListeners.set(event, callback);
        },
        webContents: {
            send(...args) {
                sent.push(args);
            },
            toggleDevTools() {
                calls.push(["toggleDevTools"]);
                return "devtools";
            },
            downloadURL: operation("downloadURL"),
            session: {
                on(event, callback) {
                    sessionListeners.set(event, callback);
                }
            }
        },
        isMaximized() {
            return maximized;
        },
        isFullScreen: () => false,
        unmaximize() {
            maximized = false;
            calls.push(["unmaximize"]);
            return "unmaximized";
        },
        close: operation("close"),
        blur: operation("blur"),
        hide: operation("hide"),
        minimize: operation("minimize"),
        maximize: operation("maximize"),
        setAlwaysOnTop: operation("setAlwaysOnTop"),
        isVisible: operation("isVisible"),
        setFullScreen: operation("setFullScreen"),
        reload: operation("reload")
    };

    const app = {
        isQuiting: false,
        isPackaged: true,
        dock: {
            show: operation("dock-show"),
            hide: operation("dock-hide")
        },
        getPath: operation("getPath"),
        getAppPath: operation("getAppPath"),
        getName: operation("getName"),
        getVersion: operation("getVersion"),
        setLoginItemSettings: operation("setLoginItemSettings"),
        relaunch: operation("relaunch"),
        exit: operation("exit"),
        quit: operation("quit")
    };
    const dialog = {
        showMessageBox: operation("showMessageBox"),
        showOpenDialogSync: operation("showOpenDialogSync")
    };
    const globalShortcut = {
        register(accelerator, callback) {
            calls.push(["register", accelerator]);
            shortcutCallback = callback;
            return true;
        },
        unregister: operation("unregister"),
        isRegistered: operation("isRegistered"),
        unregisterAll: operation("unregisterAll")
    };
    const nativeTheme = {
        shouldUseDarkColors: false,
        on(event, callback) {
            themeListeners.set(event, callback);
        }
    };
    const powerSaveBlocker = {
        start: operation("power-start"),
        stop: operation("power-stop")
    };
    const clipboard = {
        readText: () => "clipboard-value",
        writeText: operation("clipboard-write")
    };

    registerCoreIpc({
        ipcMain,
        app,
        dialog,
        globalShortcut,
        nativeTheme,
        powerSaveBlocker,
        clipboard,
        getMainWindow: () => mainWindow
    });
    registerDownloadIpc({ ipcMain, getMainWindow: () => mainWindow });
    registerMainWindowLifecycle({
        mainWindow,
        app,
        globalShortcut,
        getTray: () => ({}) ,
        platform: "win32"
    });

    assert.deepEqual(
        [...handlers.keys()].sort(),
        [
            "app",
            "clipboard",
            "dialog",
            "globalShortcut",
            "native-admin",
            "nativeTheme",
            "powerSaveBlocker",
            "start-download",
            "webContent",
            "window"
        ]
    );

    assert.equal(await invoke("app", "isPackaged"), true);
    assert.equal(await invoke("app", "getPath", "temp"), "getPath-result");
    assert.deepEqual(calls.at(-1), ["getPath", "temp"]);
    assert.equal(await invoke("app", "exit", 7), "exit-result");
    assert.deepEqual(calls.slice(-2), [["unmaximize"], ["exit", 7]]);
    ipcListeners.get("cleanup-done")();
    assert.equal(app.isQuiting, true);
    assert.deepEqual(calls.at(-1), ["quit"]);

    assert.equal(await invoke("window", "setAlwaysOnTop", true), "setAlwaysOnTop-result");
    assert.deepEqual(calls.at(-1), ["setAlwaysOnTop", true]);
    assert.equal(await invoke("webContent", "toggleDevTools"), "devtools");

    assert.equal(await invoke("dialog", "showMessageBox", { title: "test" }), "showMessageBox-result");
    assert.deepEqual(calls.at(-1), ["showMessageBox", mainWindow, { title: "test" }]);

    assert.equal(await invoke("globalShortcut", "register", "Ctrl+Shift+X"), true);
    shortcutCallback();
    assert.deepEqual(sent.at(-1), ["shortcut-pressed", "Ctrl+Shift+X"]);

    assert.equal(await invoke("nativeTheme", "shouldUseDarkColors"), false);
    nativeTheme.shouldUseDarkColors = true;
    themeListeners.get("updated")();
    assert.deepEqual(sent.at(-1), ["native-theme-updated", true]);

    assert.equal(await invoke("powerSaveBlocker", "start", "prevent-app-suspension"), "power-start-result");
    assert.deepEqual(calls.at(-1), ["power-start", "prevent-app-suspension"]);

    const readClipboardEvent = { sender: mainWindow.webContents };
    assert.equal(await handlers.get("clipboard")(readClipboardEvent, "readText"), "clipboard-value");
    await handlers.get("clipboard")({ sender: mainWindow.webContents }, "writeText", "copy me");
    assert.deepEqual(calls.at(-1), ["clipboard-write", "copy me"]);

    await handlers.get("start-download")(null, "https://example.test/app.exe", "C:\\Temp\\app.exe");
    assert.deepEqual(calls.at(-1), ["downloadURL", "https://example.test/app.exe"]);
    const itemListeners = new Map();
    const downloadItem = {
        setSavePath: operation("setSavePath"),
        on(event, callback) {
            itemListeners.set(event, callback);
        },
        once(event, callback) {
            itemListeners.set(event, callback);
        },
        isPaused: () => false,
        getReceivedBytes: () => 25,
        getTotalBytes: () => 100
    };
    sessionListeners.get("will-download")(null, downloadItem);
    assert.deepEqual(calls.at(-1), ["setSavePath", "C:\\Temp\\app.exe"]);
    itemListeners.get("updated")(null, "progressing");
    assert.deepEqual(sent.at(-1), ["download", "downloading", 0.25]);
    itemListeners.get("done")(null, "completed");
    assert.deepEqual(sent.at(-1), ["download", "completed"]);

    windowListeners.get("hide")();
    assert.deepEqual(sent.at(-1), ["window-event", "hide"]);
    app.isQuiting = false;
    const closeEvent = { preventDefault: operation("preventDefault") };
    windowListeners.get("close")(closeEvent);
    assert.deepEqual(calls.slice(-3), [["preventDefault"], ["blur"], ["hide"]]);
    assert.deepEqual(sent.at(-1), ["window-event", "close"]);
    windowListeners.get("session-end")(closeEvent);
    assert.deepEqual(sent.at(-1), ["app-exit"]);

    verifyEnforcedDelegation();
    console.log("core IPC smoke: PASS");

    function operation(name) {
        return function(...args) {
            calls.push([name, ...args]);
            return `${name}-result`;
        };
    }

    function invoke(channel, operationName, ...args) {
        return handlers.get(channel)(null, operationName, ...args);
    }
}

function verifyEnforcedDelegation() {
    const source = fs.readFileSync(mainPath, "utf8");
    assert.match(source, /require\("\.\/entry\/main\/register-core-ipc"\)/);
    assert.match(source, /registerCoreIpc\(\{/);
    assert.match(source, /require\("\.\/features\/download\/register-download-ipc"\)/);
    assert.match(source, /registerDownloadIpc\(\{/);
    assert.match(source, /require\("\.\/features\/window\/register-main-window-lifecycle"\)/);
    assert.match(source, /registerMainWindowLifecycle\(\{/);

    for (const channel of [
        "app",
        "window",
        "webContent",
        "dialog",
        "globalShortcut",
        "nativeTheme",
        "powerSaveBlocker"
    ]) {
        assert.equal(
            source.includes(`host.ipcMain.handle("${channel}"`),
            false,
            `main.js still owns extracted ${channel} handler`
        );
    }
    assert.equal(
        source.includes('host.ipcMain.on("cleanup-done"'),
        false,
        "main.js still owns extracted cleanup-done listener"
    );
    assert.equal(
        source.includes('host.ipcMain.handle("start-download"'),
        false,
        "main.js still owns extracted start-download handler"
    );
    assert.equal(
        source.includes('webContents.session.on("will-download"'),
        false,
        "main.js still owns extracted will-download listener"
    );
    for (const eventName of [
        "hide",
        "show",
        "close",
        "maximize",
        "unmaximize",
        "enter-full-screen",
        "leave-full-screen",
        "session-end"
    ]) {
        assert.equal(
            source.includes(`g.on("${eventName}"`),
            false,
            `main.js still owns extracted ${eventName} lifecycle listener`
        );
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
