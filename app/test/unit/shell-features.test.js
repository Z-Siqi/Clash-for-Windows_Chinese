"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const featureRoot = path.join(root, "app/main/dist/electron/features");
const coreRoot = path.join(root, "app/main/dist/electron/core");
const mainPath = path.join(root, "app/main/dist/electron/main.js");
const {
    registerWindowControlIpc
} = require(path.join(featureRoot, "window/register-window-control-ipc"));
const {
    registerPowerMonitor
} = require(path.join(featureRoot, "power/register-power-monitor"));
const {
    registerNotificationIpc
} = require(path.join(featureRoot, "notifications/register-notification-ipc"));
const {
    registerTrayStatusIpc
} = require(path.join(featureRoot, "tray/register-tray-status-ipc"));
const {
    createTrayState,
    registerTrayStateIpc
} = require(path.join(featureRoot, "tray/tray-state"));
const {
    createTrayLifecycle
} = require(path.join(featureRoot, "tray/tray-lifecycle"));
const {
    registerSpeedIndicator
} = require(path.join(featureRoot, "tray/register-speed-indicator"));
const {
    installTouchBar
} = require(path.join(featureRoot, "navigation/install-touch-bar"));
const {
    createUnsafeUrlPolicy
} = require(path.join(featureRoot, "security/unsafe-url-policy"));
const {
    createClashClientRegistry
} = require(path.join(coreRoot, "network/clash-client-registry"));
const {
    registerClashClientInfo
} = require(path.join(root, "app/main/dist/electron/entry/main/register-clash-client-info"));
const {
    registerWlanStatus
} = require(path.join(featureRoot, "network/register-wlan-status"));
const {
    registerShutdownHandler
} = require(path.join(featureRoot, "power/register-shutdown-handler"));

const ipcHandlers = new Map();
const ipcListeners = new Map();
const powerListeners = new Map();
const calls = [];
const sent = [];
const ipcMain = {
    handle(channel, handler) {
        ipcHandlers.set(channel, handler);
    },
    on(channel, listener) {
        ipcListeners.set(channel, listener);
    }
};
const mainWindow = {
    webContents: {
        send(...args) {
            sent.push(args);
        }
    },
    isVisible: () => false,
    isFocused: () => false,
    isMaximized: () => false,
    unmaximize: () => calls.push(["main-unmaximize"]),
    setTouchBar(touchBar) {
        this.touchBar = touchBar;
    }
};
const app = {
    isQuiting: false,
    quit() {
        calls.push(["quit"]);
    }
};

registerPowerMonitor({
    powerMonitor: {
        on(event, listener) {
            powerListeners.set(event, listener);
        }
    },
    getMainWindow: () => mainWindow
});
powerListeners.get("suspend")();
powerListeners.get("resume")();
assert.deepEqual(sent.slice(-2), [
    ["power-event", "suspend"],
    ["power-event", "resume"]
]);

registerWindowControlIpc({
    ipcMain,
    app,
    getMainWindow: () => mainWindow,
    showMainWindow: () => calls.push(["showMainWindow"])
});
ipcHandlers.get("window-control")(null, "show");
assert.deepEqual(calls.at(-1), ["showMainWindow"]);
ipcHandlers.get("window-control")(null, "show-or-hide");
assert.deepEqual(calls.slice(-2), [["showMainWindow"], ["showMainWindow"]]);

let notificationInstance;
class FakeNotification {
    constructor(options) {
        this.options = options;
        this.listeners = [];
        notificationInstance = this;
    }
    on(event, listener) {
        this.listeners.push([event, listener]);
    }
    show() {
        calls.push(["notification-show"]);
    }
}
registerNotificationIpc({
    ipcMain,
    Notification: FakeNotification,
    nativeImage: {
        createFromPath(iconPath) {
            calls.push(["createFromPath", iconPath]);
            return "icon";
        }
    },
    shell: {
        openPath(folder) {
            calls.push(["openPath", folder]);
        },
        openExternal(url) {
            calls.push(["openExternal", url]);
        }
    },
    path,
    staticRoot: "C:\\static",
    platform: "win32"
});
ipcListeners.get("show-notification")(null, {
    title: "Ready",
    folder: "C:\\downloads",
    url: "https://example.test"
});
assert.equal(notificationInstance.options.icon, "icon");
for (const [, listener] of notificationInstance.listeners) listener();
assert.deepEqual(calls.slice(-3), [
    ["notification-show"],
    ["openPath", "C:\\downloads"],
    ["openExternal", "https://example.test"]
]);

const tray = { setImage: image => calls.push(["setImage", image]) };
registerTrayStatusIpc({
    ipcMain,
    trayIconController: { update: image => tray.setImage(image) }
});
ipcListeners.get("status-changed")(null, "tray.ico");
assert.deepEqual(calls.at(-1), ["setImage", "tray.ico"]);

const trayState = createTrayState();
const menuItems = new Map(
    ["system-proxy", "mixin", "tun", "mode-global", "mode-rule", "mode-direct", "mode-script"]
        .map(id => [id, { id, enabled: false, checked: false }])
);
let menuRefreshes = 0;
registerTrayStateIpc({
    ipcMain,
    state: trayState,
    isLinux: () => true,
    getLocalizedMenu: () => ({ getMenuItemById: id => menuItems.get(id) }),
    getMenus: () => [{ getMenuItemById: id => menuItems.get(id) }],
    refreshMenu: () => menuRefreshes++,
    showMainWindow: () => calls.push(["enhanced-show"])
});
ipcListeners.get("clash-core-status-change")(null, 0);
assert.equal(trayState.isReady, true);
assert.equal(menuItems.get("system-proxy").enabled, true);
ipcHandlers.get("tray-proxies-style")(null, 0);
assert.equal(trayState.menuStyle, 1);
ipcHandlers.get("tray-proxies-style")(null, 1);
assert.equal(trayState.menuStyle, 0);
ipcHandlers.get("tray-proxies-style")(null, 99);
assert.equal(trayState.menuStyle, 2);
ipcListeners.get("mode-changed")(null, "rule");
assert.equal(trayState.menuMode, "rule");
assert.equal(menuItems.get("mode-rule").checked, true);
ipcListeners.get("core-type-changed")(null, "mihomo");
assert.equal(trayState.coreType, "mihomo");
assert.equal(menuItems.get("mode-script").visible, false);
ipcListeners.get("mode-changed")(null, "script");
assert.equal(trayState.menuMode, "rule");
ipcListeners.get("mixin-changed")(null, true);
assert.equal(trayState.mixinChecked, true);
assert.equal(menuItems.get("mixin").checked, true);
ipcListeners.get("enhanced-tray-click")();
assert.deepEqual(calls.at(-1), ["enhanced-show"]);
assert.equal(menuRefreshes >= 3, true);

class FakeTray {
    constructor(icon) {
        this.icon = icon;
        this.listeners = new Map();
        calls.push(["tray-created", icon]);
    }
    setToolTip(value) {
        calls.push(["tray-tooltip", value]);
    }
    on(event, listener) {
        this.listeners.set(event, listener);
    }
    popUpContextMenu(menu) {
        calls.push(["tray-menu", menu]);
    }
    destroy() {
        calls.push(["tray-destroy"]);
    }
}
const fakeMacIcon = {
    resize() {
        return this;
    },
    setTemplateImage(value) {
        calls.push(["template-image", value]);
    }
};
let changedTray;
const trayLifecycle = createTrayLifecycle({
    ipcMain,
    Tray: FakeTray,
    Menu: { buildFromTemplate: template => ({ template }) },
    nativeImage: { createFromPath: () => fakeMacIcon },
    path,
    staticRoot: "C:\\static",
    platform: "win32",
    buildContextMenu: () => Promise.resolve([{ label: "Dashboard" }]),
    showMainWindow: () => calls.push(["tray-show"]),
    onTrayChanged: value => { changedTray = value; }
});
const createdTray = trayLifecycle.create();
assert.equal(changedTray, createdTray);
assert.match(createdTray.icon, /tray_normal\.ico$/);
createdTray.listeners.get("click")();
assert.deepEqual(calls.at(-1), ["tray-show"]);
ipcHandlers.get("tray-create-destroy")(null, "destroy");
assert.equal(changedTray, null);
assert.deepEqual(calls.at(-1), ["tray-destroy"]);

let indicatorWindow;
class FakeIndicatorWindow {
    constructor(options) {
        this.options = options;
        this.webContents = {
            send: (...args) => calls.push(["indicator-send", ...args])
        };
        indicatorWindow = this;
    }
    loadFile(filePath) {
        calls.push(["indicator-load", filePath]);
    }
    show() {
        calls.push(["indicator-show"]);
    }
    setBounds(bounds) {
        calls.push(["indicator-bounds", bounds]);
    }
    destroy() {
        calls.push(["indicator-destroy"]);
    }
}
const croppedImage = {
    getSize: () => ({ width: 84, height: 69 }),
    toDataURL: () => "cropped-data"
};
registerSpeedIndicator({
    ipcMain,
    BrowserWindow: FakeIndicatorWindow,
    nativeImage: {
        createFromDataURL: () => ({ crop: () => croppedImage }),
        createFromPath: () => croppedImage
    },
    app: { getPath: () => "C:\\Temp" },
    fs: {
        writeFileSync(filePath, content) {
            calls.push(["indicator-write", filePath, content]);
        }
    },
    path,
    staticRoot: "C:\\static",
    getTray: () => tray,
    platform: "win32"
});
ipcListeners.get("speed-update")(null, "source-data", 20, "#123456");
assert.equal(indicatorWindow.options.alwaysOnTop, true);
assert.deepEqual(calls.at(-1), [
    "indicator-bounds",
    { height: 25, width: 31 }
]);
ipcListeners.get("speed-update")(null, "source-data", 60);
assert.deepEqual(calls.at(-1), ["indicator-destroy"]);

let wlanListener;
let wlanStopped = false;
registerWlanStatus({
    ipcMain,
    networkChangeMonitor: {
        subscribe(listener) {
            wlanListener = listener;
            return () => { wlanStopped = true; };
        }
        ,stop() { wlanStopped = true; }
    },
    getMainWindow: () => mainWindow
});
ipcHandlers.get("wlan-status-wanted")();
wlanListener(null, { ssid: "test" });
assert.deepEqual(sent.at(-1), ["wlan-status-changed", { ssid: "test" }]);
wlanListener({ code: "failed" });
assert.equal(sent.at(-1)[0], "wlan-status-listen-error");
assert.equal(wlanStopped, false);

registerShutdownHandler({
    powerMonitor: {
        on(event, listener) {
            powerListeners.set(event, listener);
        }
    },
    app,
    getMainWindow: () => mainWindow,
    setTimeoutFn(callback, delay) {
        assert.equal(delay, 5000);
        callback();
    }
});
powerListeners.get("shutdown")({ preventDefault: () => calls.push(["shutdown-prevented"]) });
assert.deepEqual(sent.at(-1), ["app-exit"]);
assert.equal(app.isQuiting, true);
assert.deepEqual(calls.at(-1), ["quit"]);

class FakeTouchBarButton {
    constructor(options) {
        Object.assign(this, options);
    }
}
class FakeTouchBar {
    constructor(options) {
        Object.assign(this, options);
    }
}
installTouchBar({
    mainWindow,
    TouchBar: FakeTouchBar,
    TouchBarButton: FakeTouchBarButton
});
assert.equal(mainWindow.touchBar.items.length, 7);
mainWindow.touchBar.items[1].click();
assert.deepEqual(sent.at(-1), ["menu-item-change", "proxy"]);

const policy = createUnsafeUrlPolicy({ ipcMain });
ipcListeners.get("set-allow-unsafe-urls")(null, ["https://unsafe.test"]);
assert.equal(policy.includes("https://unsafe.test"), true);
assert.equal(policy.includes("https://other.test"), false);

let axiosConfig;
const clashClient = createClashClientRegistry({
    axios: {
        create(config) {
            axiosConfig = config;
            return { id: "client" };
        }
    }
});
registerClashClientInfo({ ipcMain, registry: clashClient });
ipcListeners.get("clash-core-info")(null, { port: 9090, secret: "token" });
assert.deepEqual(axiosConfig, {
    baseURL: "http://127.0.0.1:9090/",
    timeout: 5000,
    headers: { Authorization: "Bearer token" }
});
assert.deepEqual(clashClient.getClient(), { id: "client" });

verifyDelegation();
console.log("shell features smoke: PASS");

function verifyDelegation() {
    const source = fs.readFileSync(mainPath, "utf8");
    for (const requiredPath of [
        "window/register-window-control-ipc",
        "power/register-power-monitor",
        "notifications/register-notification-ipc",
        "tray/register-tray-status-ipc",
        "tray/tray-icon-controller",
        "tray/tray-state",
        "tray/tray-lifecycle",
        "tray/register-speed-indicator",
        "navigation/install-touch-bar",
        "security/unsafe-url-policy",
        "network/network-change-monitor",
        "network/register-wlan-status",
        "power/register-shutdown-handler"
    ]) {
        assert.match(source, new RegExp(`require\\("\\./features/${requiredPath}"\\)`));
    }
    assert.match(source, /require\("\.\/core\/network\/clash-client-registry"\)/);
    assert.match(source, /require\("\.\/core\/network\/clash-api"\)/);
    assert.match(source, /require\("\.\/entry\/main\/register-clash-client-info"\)/);
    for (const oldOwner of [
        'host.ipcMain.handle("window-control"',
        'host.ipcMain.on("status-changed"',
        'host.ipcMain.on("show-notification"',
        'host.ipcMain.on("clash-core-info"',
        'host.ipcMain.on("set-allow-unsafe-urls"',
        'host.ipcMain.on("clash-core-status-change"',
        'host.ipcMain.handle("tray-proxies-style"',
        'host.ipcMain.handle("tray-proxies-icon"',
        'host.ipcMain.on("mode-changed"',
        'host.ipcMain.handle("cfw-language"',
        'host.ipcMain.on("system-proxy-changed"',
        'host.ipcMain.on("mixin-changed"',
        'host.ipcMain.on("tun-changed"',
        'host.ipcMain.on("enhanced-tray-click"',
        'host.ipcMain.handle("tray-create-destroy"',
        'host.ipcMain.on("speed-update"',
        'host.ipcMain.handle("wlan-status-wanted"',
        'host.powerMonitor.on("suspend"',
        'host.powerMonitor.on("shutdown"',
        "g.setTouchBar(",
        "new host.Tray("
    ]) {
        assert.equal(source.includes(oldOwner), false, `main.js still owns ${oldOwner}`);
    }
}
