const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const patchLayerDir = path.join(repoRoot, "app", "main", "dist", "electron", "patch-layer");
const rendererPatchPath = path.join(patchLayerDir, "renderer-patch.js");
const ipcPackageDir = path.join(patchLayerDir, "packages", "ipc");
const ipcClientPath = path.join(ipcPackageDir, "ipc-client.js");
const appIpcPath = path.join(ipcPackageDir, "app-ipc.js");
const windowIpcPath = path.join(ipcPackageDir, "window-ipc.js");
const dialogIpcPath = path.join(ipcPackageDir, "dialog-ipc.js");
const globalShortcutIpcPath = path.join(ipcPackageDir, "global-shortcut-ipc.js");
const runtimeIpcPath = path.join(ipcPackageDir, "runtime-ipc.js");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function runScript(context, scriptPath) {
    const source = fs.readFileSync(scriptPath, "utf8");
    const script = new vm.Script(source, {
        filename: scriptPath
    });

    script.runInContext(context);
}

function createRuntime() {
    const runtime = {
        console,
        location: {
            href: "file:///D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree/app/main/dist/electron/index.html"
        },
        document: {
            readyState: "loading",
            documentElement: {
                dataset: {}
            },
            getElementById(id) {
                return id === "app" ? { id: "app" } : null;
            },
            querySelector(selector) {
                return selector === "#app" ? { id: "app" } : null;
            },
            addEventListener() {}
        }
    };

    runtime.addEventListener = function addEventListener() {};
    runtime.window = runtime;
    runtime.globalThis = runtime;
    return runtime;
}

function createIpcRecorder() {
    const calls = [];

    return {
        calls,
        ipcRenderer: {
            invoke(channel, method, ...args) {
                calls.push({ channel, method, args });
                return Promise.resolve({ channel, method, args });
            }
        }
    };
}

function main() {
    const runtime = createRuntime();
    const context = vm.createContext(runtime);

    [
        rendererPatchPath,
        ipcClientPath,
        appIpcPath,
        windowIpcPath,
        dialogIpcPath,
        globalShortcutIpcPath,
        runtimeIpcPath
    ].forEach((scriptPath) => runScript(context, scriptPath));

    const recorder = createIpcRecorder();
    const ipcRenderer = recorder.ipcRenderer;

    runtime.__CFW_APP_IPC__.getPath(ipcRenderer, "temp");
    runtime.__CFW_APP_IPC__.getVersion(ipcRenderer);
    runtime.__CFW_APP_IPC__.setLoginItemSettings(ipcRenderer, { openAtLogin: true });
    runtime.__CFW_WINDOW_IPC__.setFullScreen(ipcRenderer, false);
    runtime.__CFW_WINDOW_IPC__.show(ipcRenderer);
    runtime.__CFW_DIALOG_IPC__.showOpenDialogSync(ipcRenderer, { properties: ["openFile"] });
    runtime.__CFW_GLOBAL_SHORTCUT_IPC__.register(ipcRenderer, "CommandOrControl+Shift+D");
    runtime.__CFW_RUNTIME_IPC__.shouldUseDarkColors(ipcRenderer);
    runtime.__CFW_RUNTIME_IPC__.startPowerSaveBlocker(ipcRenderer, "prevent-app-suspension");
    runtime.__CFW_RUNTIME_IPC__.toggleDevTools(ipcRenderer);

    const compactCalls = recorder.calls.map((call) => `${call.channel}:${call.method}:${JSON.stringify(call.args)}`);

    assert(runtime.__CFW_IPC_CLIENT__.version === "009-large-ipc-settings-runtime-extraction", "IPC client version mismatch.");
    assert(runtime.__CFW_APP_IPC__.version === "009-large-ipc-settings-runtime-extraction", "app IPC version mismatch.");
    assert(runtime.__CFW_WINDOW_IPC__.version === "009-large-ipc-settings-runtime-extraction", "window IPC version mismatch.");
    assert(runtime.__CFW_DIALOG_IPC__.version === "009-large-ipc-settings-runtime-extraction", "dialog IPC version mismatch.");
    assert(runtime.__CFW_GLOBAL_SHORTCUT_IPC__.version === "009-large-ipc-settings-runtime-extraction", "global shortcut IPC version mismatch.");
    assert(runtime.__CFW_RUNTIME_IPC__.version === "009-large-ipc-settings-runtime-extraction", "runtime IPC version mismatch.");
    assert(compactCalls.includes('app:getPath:["temp"]'), "app getPath call mismatch.");
    assert(compactCalls.includes('app:getVersion:[]'), "app getVersion call mismatch.");
    assert(compactCalls.includes('app:setLoginItemSettings:[{"openAtLogin":true}]'), "app setLoginItemSettings call mismatch.");
    assert(compactCalls.includes('window:setFullScreen:[false]'), "window setFullScreen call mismatch.");
    assert(compactCalls.includes('window-control:show:[]'), "window-control show call mismatch.");
    assert(compactCalls.includes('dialog:showOpenDialogSync:[{"properties":["openFile"]}]'), "dialog showOpenDialogSync call mismatch.");
    assert(compactCalls.includes('globalShortcut:register:["CommandOrControl+Shift+D"]'), "globalShortcut register call mismatch.");
    assert(compactCalls.includes('nativeTheme:shouldUseDarkColors:[]'), "nativeTheme shouldUseDarkColors call mismatch.");
    assert(compactCalls.includes('powerSaveBlocker:start:["prevent-app-suspension"]'), "powerSaveBlocker start call mismatch.");
    assert(compactCalls.includes('webContent:toggleDevTools:[]'), "webContent toggleDevTools call mismatch.");

    const scriptNames = runtime.__CFW_PATCH_LAYER__.scriptOrder.map((entry) => entry.name);
    [
        "packages/ipc/app-ipc.js",
        "packages/ipc/window-ipc.js",
        "packages/ipc/dialog-ipc.js",
        "packages/ipc/global-shortcut-ipc.js",
        "packages/ipc/runtime-ipc.js"
    ].forEach((name) => assert(scriptNames.includes(name), `${name} script order missing.`));

    console.log("IPC clusters smoke check passed.");
    console.log(`Version: ${runtime.__CFW_IPC_CLIENT__.version}`);
    console.log(`Recorded calls: ${recorder.calls.length}`);
}

main();
