"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const mainPath = path.join(root, "app/main/dist/electron/main.js");
const preloadPath = path.join(root, "app/main/dist/electron/preload.js");
const indexPath = path.join(root, "app/main/dist/electron/index.html");
const preloadLoaderPath = path.join(root, "app/main/dist/electron/entry/renderer/preload-loader.js");
const {
    createMainWindow
} = require(path.join(root, "app/main/dist/electron/features/window/create-main-window"));
const {
    createShowMainWindow
} = require(path.join(root, "app/main/dist/electron/features/window/show-main-window"));

async function main() {
    const calls = [];
    let createdWindow;
    class FakeBrowserWindow {
        constructor(options) {
            this.options = options;
            this.listeners = new Map();
            this.webContents = {
                listeners: new Map(),
                on: (event, listener) => this.webContents.listeners.set(event, listener),
                paste: () => calls.push(["paste"])
            };
            createdWindow = this;
        }
        setMenu(value) {
            calls.push(["set-menu", value]);
        }
        loadURL(url, options) {
            calls.push(["load-url", url, options]);
        }
    }
    let crashChoice = 0;
    const app = {
        getVersion: () => "1.2.3",
        quit: () => calls.push(["quit"])
    };
    createMainWindow({
        BrowserWindow: FakeBrowserWindow,
        nativeTheme: { shouldUseDarkColors: true },
        path,
        dirname: "C:\\electron",
        staticRoot: "C:\\static",
        isLinux: () => true,
        app,
        dialog: {
            showMessageBox: async (_window, options) => {
                calls.push(["crash-dialog", options.message]);
                return { response: crashChoice };
            }
        },
        platform: "win32",
        url: "file:///index.html",
        localize: (english, chinese) => `${english}|${chinese}`,
        onRelaunch: () => calls.push(["relaunch"])
    });
    assert.equal(createdWindow.options.width, 850);
    assert.equal(createdWindow.options.backgroundColor, "#272531");
    assert.match(createdWindow.options.icon, /icon_512\.png$/);
    assert.match(createdWindow.options.webPreferences.preload, /preload\.js$/);
    assert.equal(createdWindow.options.webPreferences.nodeIntegration, false);
    assert.equal(createdWindow.options.webPreferences.nodeIntegrationInWorker, false);
    assert.equal(createdWindow.options.webPreferences.contextIsolation, true);
    assert.equal(createdWindow.options.webPreferences.sandbox, false);
    assert.equal(createdWindow.options.webPreferences.webSecurity, true);
    assert.deepEqual(calls.at(-1), [
        "load-url",
        "file:///index.html",
        { userAgent: "ClashforWindows/1.2.3" }
    ]);
    let prevented = false;
    createdWindow.webContents.listeners.get("will-navigate")({
        preventDefault: () => { prevented = true; }
    });
    assert.equal(prevented, true);
    let pastePrevented = false;
    createdWindow.webContents.listeners.get("before-input-event")(
        { preventDefault: () => { pastePrevented = true; } },
        { type: "keyDown", key: "v", control: true, meta: false, alt: false, shift: false, isAutoRepeat: false }
    );
    assert.equal(pastePrevented, true);
    assert.deepEqual(calls.at(-1), ["paste"]);
    pastePrevented = false;
    createdWindow.webContents.listeners.get("before-input-event")(
        { preventDefault: () => { pastePrevented = true; } },
        { type: "keyDown", key: "v", control: true, meta: false, alt: false, shift: true, isAutoRepeat: false }
    );
    assert.equal(pastePrevented, false);
    await createdWindow.webContents.listeners.get("render-process-gone")(null, {
        reason: "crashed"
    });
    assert.deepEqual(calls.at(-1), ["relaunch"]);
    crashChoice = 1;
    await createdWindow.webContents.listeners.get("render-process-gone")(null, {
        reason: "crashed"
    });
    assert.deepEqual(calls.at(-1), ["quit"]);

    const showWindow = {
        isMinimized: () => true,
        restore: () => calls.push(["restore"]),
        show: () => calls.push(["show"]),
        setVisibleOnAllWorkspaces: value => calls.push(["all-workspaces", value])
    };
    createShowMainWindow({
        getMainWindow: () => showWindow,
        platform: "win32"
    })();
    assert.deepEqual(calls.at(-1), ["restore"]);
    createShowMainWindow({
        getMainWindow: () => showWindow,
        platform: "linux",
        setTimeoutFn: callback => callback()
    })();
    assert.deepEqual(calls.slice(-3), [
        ["all-workspaces", true],
        ["show"],
        ["all-workspaces", false]
    ]);

    verifyDelegation();
    console.log("window shell smoke: PASS");
}

function verifyDelegation() {
    assert.equal(fs.existsSync(preloadPath), true, "packaged preload entry is missing");
    assert.equal(fs.existsSync(preloadLoaderPath), true, "isolated renderer loader is missing");
    const html = fs.readFileSync(indexPath, "utf8");
    assert.doesNotMatch(html, /<script|\bprocess\b|\brequire\s*\(/, "page main world must not execute privileged code");
    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /script-src 'self'/);
    assert.doesNotMatch(html, /unsafe-eval/, "page main-world CSP must not allow string evaluation");
    assert.match(html, /object-src 'none'/);
    assert.match(html, /base-uri 'none'/);
    const preload = fs.readFileSync(preloadPath, "utf8");
    assert.match(preload, /webFrame\.setIsolatedWorldInfo\(999, \{/);
    assert.match(preload, /securityOrigin: "cfw-preload:\/\/renderer"/);
    assert.match(preload, /script-src 'self' 'unsafe-eval' file:/);
    assert.match(preload, /createPreloadLoader\(\{/);
    assert.doesNotMatch(preload, /contextBridge\.exposeInMainWorld/, "main page must not receive a generic preload bridge");
    const source = fs.readFileSync(mainPath, "utf8");
    assert.match(source, /require\("\.\/features\/window\/create-main-window"\)/);
    assert.match(source, /require\("\.\/features\/window\/show-main-window"\)/);
    assert.match(source, /createMainWindowShell\(\{/);
    assert.match(source, /createShowMainWindow\(\{/);
    for (const oldOwner of [
        "new host.BrowserWindow({",
        'g.webContents.on("will-navigate"',
        'g.webContents.on("render-process-gone"',
        "function Launch()"
    ]) {
        assert.equal(source.includes(oldOwner), false, `main.js still owns ${oldOwner}`);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
