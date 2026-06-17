const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const patchLayerDir = path.join(repoRoot, "app", "main", "dist", "electron", "patch-layer");
const rendererPatchPath = path.join(patchLayerDir, "renderer-patch.js");
const routeCatalogPath = path.join(patchLayerDir, "routes", "route-catalog.js");
const menuStatePath = path.join(patchLayerDir, "packages", "menu", "menu-state.js");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function createRuntime() {
    const runtime = {
        console,
        location: {
            href: "file:///D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree/app/main/dist/electron/index.html#/home/proxy"
        },
        document: {
            readyState: "loading",
            documentElement: {
                dataset: {}
            },
            _appRoot: {
                id: "app",
                dataset: {}
            },
            getElementById(id) {
                return id === "app" ? this._appRoot : null;
            },
            querySelector(selector) {
                return selector === "#app" ? this._appRoot : null;
            }
        }
    };

    runtime.CustomEvent = function CustomEvent(type, options) {
        this.type = type;
        this.detail = options && options.detail ? options.detail : null;
    };

    runtime.addEventListener = function addEventListener() {};
    runtime.dispatchEvent = function dispatchEvent() {
        return true;
    };
    runtime.setTimeout = function setTimeout(callback) {
        callback();
        return 1;
    };

    runtime.window = runtime;
    runtime.globalThis = runtime;
    return runtime;
}

function runScript(context, scriptPath) {
    const source = fs.readFileSync(scriptPath, "utf8");
    const script = new vm.Script(source, {
        filename: scriptPath
    });

    script.runInContext(context);
}

function createStorage(value) {
    return {
        calls: [],
        get(key) {
            this.calls.push(key);
            return value;
        }
    };
}

function main() {
    const runtime = createRuntime();
    const context = vm.createContext(runtime);

    runScript(context, rendererPatchPath);
    runScript(context, routeCatalogPath);
    runScript(context, menuStatePath);

    const menuState = runtime.__CFW_MENU_STATE__;
    const patchLayer = runtime.__CFW_PATCH_LAYER__;
    const storageWithValue = createStorage("/home/proxy");
    const storageWithEmptyValue = createStorage("");

    assert(menuState, "window.__CFW_MENU_STATE__ was not created.");
    assert(menuState.version === "007-menu-current-route-extraction", "menu state version mismatch.");
    assert(menuState.fallbackPath === "/home/general", "menu state fallback path mismatch.");
    assert(menuState.currentRouteStorageKey === "currentRoutePath", "current route storage key mismatch.");
    assert(menuState.getInitialCurrentRoutePath(storageWithValue, "currentRoutePath") === "/home/proxy", "stored current route was not preserved.");
    assert(storageWithValue.calls.join(",") === "currentRoutePath", "storage key call mismatch.");
    assert(menuState.getInitialCurrentRoutePath(storageWithEmptyValue, "currentRoutePath") === "/home/general", "empty current route did not fall back.");
    assert(menuState.getInitialCurrentRoutePath(null, "currentRoutePath") === "/home/general", "missing storage did not fall back.");
    assert(menuState.getInitialCurrentRoutePath({ get: () => null }, "currentRoutePath", "/home/setting") === "/home/setting", "explicit fallback mismatch.");
    assert(patchLayer.probes.some((probe) => probe.name === "patch-layer-core-loaded"), "patch layer core probe missing.");
    assert(patchLayer.health.scriptOrder.some((entry) => entry.name === "packages/menu/menu-state.js"), "menu state script order record missing.");

    console.log("Menu state smoke check passed.");
    console.log(`Version: ${menuState.version}`);
    console.log(`Fallback path: ${menuState.fallbackPath}`);
    console.log(`Stored route: ${menuState.getInitialCurrentRoutePath(createStorage("/home/proxy"), "currentRoutePath")}`);
}

main();
