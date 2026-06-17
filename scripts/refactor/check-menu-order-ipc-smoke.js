const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const patchLayerDir = path.join(repoRoot, "app", "main", "dist", "electron", "patch-layer");
const rendererPatchPath = path.join(patchLayerDir, "renderer-patch.js");
const menuOrderPath = path.join(patchLayerDir, "packages", "menu", "menu-order.js");
const ipcClientPath = path.join(patchLayerDir, "packages", "ipc", "ipc-client.js");

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

function main() {
    const runtime = createRuntime();
    const context = vm.createContext(runtime);

    runScript(context, rendererPatchPath);
    runScript(context, menuOrderPath);
    runScript(context, ipcClientPath);

    const menuOrder = runtime.__CFW_MENU_ORDER__;
    const ipcClient = runtime.__CFW_IPC_CLIENT__;
    const storage = {
        get(key) {
            assert(key === "menuItemOrder", "menu order storage key mismatch.");
            return ["Settings", "General", "Proxies"];
        }
    };
    const sorted = menuOrder.sortMenuItems([
        { title: "Proxies" },
        { title: "General" },
        { title: "Settings" }
    ], storage, "menuItemOrder");
    const calls = [];
    const ipcRenderer = {
        invoke(channel, method, ...args) {
            calls.push({ channel, method, args });
            return `${channel}:${method}`;
        }
    };

    assert(menuOrder.version === "008-batched-enforced-extractions", "menu order version mismatch.");
    assert(sorted.map((item) => item.title).join(",") === "Settings,General,Proxies", "menu order sorting mismatch.");
    assert(menuOrder.compareMenuItems({ title: "Unknown" }, { title: "Settings" }, storage, "menuItemOrder") === 1, "unknown menu item compare mismatch.");
    assert(ipcClient.version === "009-large-ipc-settings-runtime-extraction", "ipc client version mismatch.");
    assert(ipcClient.channels.window === "window", "window channel mismatch.");
    assert(ipcClient.invokeWindow(ipcRenderer, "minimize") === "window:minimize", "invokeWindow result mismatch.");
    assert(ipcClient.invokeApp(ipcRenderer, "quit") === "app:quit", "invokeApp result mismatch.");
    assert(ipcClient.invoke(ipcRenderer, "window", "setAlwaysOnTop", true) === "window:setAlwaysOnTop", "generic invoke result mismatch.");
    assert(calls[2].args[0] === true, "generic invoke args mismatch.");
    assert(runtime.__CFW_PATCH_LAYER__.scriptOrder.some((entry) => entry.name === "packages/menu/menu-order.js"), "menu order script order missing.");
    assert(runtime.__CFW_PATCH_LAYER__.scriptOrder.some((entry) => entry.name === "packages/ipc/ipc-client.js"), "ipc client script order missing.");

    console.log("Menu order and IPC smoke check passed.");
    console.log(`Menu order version: ${menuOrder.version}`);
    console.log(`IPC client version: ${ipcClient.version}`);
    console.log(`First sorted item: ${sorted[0].title}`);
}

main();
