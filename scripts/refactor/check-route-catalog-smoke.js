const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const patchLayerDir = path.join(repoRoot, "app", "main", "dist", "electron", "patch-layer");
const rendererPatchPath = path.join(patchLayerDir, "renderer-patch.js");
const runtimeProbePath = path.join(patchLayerDir, "runtime-smoke-probe.js");
const readinessProbePath = path.join(patchLayerDir, "renderer-readiness-probe.js");
const routeCatalogPath = path.join(patchLayerDir, "routes", "route-catalog.js");
const routeReadinessProbePath = path.join(patchLayerDir, "route-readiness-probe.js");
const storeModuleVisibilityProbePath = path.join(patchLayerDir, "store-module-visibility-probe.js");
const ipcSurfacePresenceProbePath = path.join(patchLayerDir, "ipc-surface-presence-probe.js");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function createRuntime() {
    const windowListeners = new Map();
    const documentListeners = new Map();
    const scheduledTimers = [];
    const fakeStore = {
        state: {
            app: {
                currentRoutePath: "/home/proxy"
            }
        },
        getters: {
            currentRoutePath: "/home/proxy",
            menuItems: []
        }
    };
    const fakeVue = {
        $options: {
            name: "Clash"
        },
        $store: fakeStore,
        $router: {
            mode: "hash"
        },
        $route: {
            path: "/home/proxy"
        }
    };
    const runtime = {
        console,
        process: {
            type: "renderer",
            contextIsolated: false,
            versions: {
                electron: "34.0.0"
            }
        },
        location: {
            href: "file:///D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree/app/main/dist/electron/index.html#/home/proxy",
            hash: "#/home/proxy",
            pathname: "/D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree/app/main/dist/electron/index.html"
        },
        document: {
            readyState: "loading",
            documentElement: {
                dataset: {}
            },
            body: {
                className: "theme-dark"
            },
            activeElement: {
                tagName: "BODY"
            },
            _appRoot: {
                id: "app",
                dataset: {},
                __vue__: fakeVue
            },
            getElementById(id) {
                return id === "app" ? this._appRoot : null;
            },
            querySelector(selector) {
                if (selector === "#app") {
                    return this._appRoot;
                }

                if (selector === "router-view") {
                    return null;
                }

                return null;
            },
            addEventListener(type, listener) {
                const eventListeners = documentListeners.get(type) || [];
                eventListeners.push(listener);
                documentListeners.set(type, eventListeners);
            },
            dispatchEvent(event) {
                const eventListeners = documentListeners.get(event.type) || [];
                eventListeners.forEach((listener) => listener.call(this, event));
                return true;
            }
        }
    };

    runtime.require = function require(moduleName) {
        if (moduleName === "electron") {
            return {
                ipcRenderer: {
                    send() {},
                    invoke() {},
                    on() {},
                    once() {},
                    removeListener() {},
                    removeAllListeners() {}
                }
            };
        }

        throw new Error(`Unexpected require: ${moduleName}`);
    };

    runtime.CustomEvent = function CustomEvent(type, options) {
        this.type = type;
        this.detail = options && options.detail ? options.detail : null;
    };

    runtime.Event = function Event(type) {
        this.type = type;
    };

    runtime.addEventListener = function addEventListener(type, listener) {
        const eventListeners = windowListeners.get(type) || [];
        eventListeners.push(listener);
        windowListeners.set(type, eventListeners);
    };

    runtime.dispatchEvent = function dispatchEvent(event) {
        const eventListeners = windowListeners.get(event.type) || [];
        eventListeners.forEach((listener) => listener.call(runtime, event));
        return true;
    };

    runtime.setTimeout = function setTimeout(callback, delay) {
        scheduledTimers.push({
            callback,
            delay
        });
        return scheduledTimers.length;
    };

    runtime.__flushTimers = function flushTimers(maxIterations) {
        const limit = maxIterations || 20;
        let iterations = 0;

        while (scheduledTimers.length > 0 && iterations < limit) {
            const timer = scheduledTimers.shift();
            iterations += 1;
            timer.callback();
        }
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

function dispatchLifecycle(runtime) {
    runtime.document.readyState = "interactive";
    runtime.document.dispatchEvent(new runtime.Event("readystatechange"));
    runtime.document.dispatchEvent(new runtime.Event("DOMContentLoaded"));

    runtime.document.readyState = "complete";
    runtime.document.dispatchEvent(new runtime.Event("readystatechange"));
    runtime.dispatchEvent(new runtime.Event("load"));
    runtime.__flushTimers();
}

function main() {
    const runtime = createRuntime();
    const readyEvents = [];
    const context = vm.createContext(runtime);

    runtime.addEventListener("cfw:patch-layer-ready", (event) => {
        readyEvents.push(event);
    });

    runScript(context, rendererPatchPath);
    runScript(context, runtimeProbePath);
    runScript(context, readinessProbePath);
    runScript(context, routeCatalogPath);
    runScript(context, routeReadinessProbePath);
    runScript(context, storeModuleVisibilityProbePath);
    runScript(context, ipcSurfacePresenceProbePath);

    runtime.__CFW_RENDERER_AFTER_PATCH_MARKER__ = {
        source: "mock-renderer.js",
        loadedAt: new Date().toISOString()
    };

    runtime.__CFW_PATCH_LAYER__.recordScript("mock-renderer.js", {
        source: "scripts/refactor/check-route-catalog-smoke.js"
    });

    dispatchLifecycle(runtime);

    const catalog = runtime.__CFW_ROUTE_CATALOG__;
    const patchLayer = runtime.__CFW_PATCH_LAYER__;
    const health = patchLayer.getHealth();
    const routeIds = catalog.getRoutes().map((route) => route.id).join(",");
    const menuItems = catalog.buildMenuItems({
        general: () => "General",
        proxies: () => "Proxies",
        profiles: () => "Profiles",
        logs: () => "Logs",
        connections: () => "Connections",
        settings: () => "Settings",
        feedback: () => "Feedback"
    });
    const builtRoutes = catalog.buildVueRouterRoutes((chunkId) => ({
        Z: `component-${chunkId}`
    }));
    const scriptOrder = health.scriptOrder.map((entry) => entry.name);
    const routeProbe = health.routeReadiness;
    const storeProbe = health.storeModuleVisibility;
    const ipcProbe = health.ipcSurfacePresence;

    assert(readyEvents.length === 1, "cfw:patch-layer-ready was not observed exactly once.");
    assert(health.version === "006-enforced-route-delegation", "health.version mismatch.");
    assert(catalog.version === "006-enforced-route-delegation", "route catalog version mismatch.");
    assert(catalog.routes.length === 9, "route catalog route count mismatch.");
    assert(catalog.getMenuRoutes().length === 7, "route catalog menu route count mismatch.");
    assert(routeIds === "general,proxy,provider,log,server,connection,router,setting,about", "route catalog order mismatch.");
    assert(catalog.normalizePath("home/proxy/") === "/home/proxy", "route normalize rule mismatch.");
    assert(catalog.findRouteByPath("/home/server").id === "server", "route lookup mismatch.");
    assert(catalog.matchRouteFromLocation({ hash: "#/home/proxy" }).route.id === "proxy", "hash route match mismatch.");
    assert(catalog.matchRouteFromLocation({ pathname: "/home/setting" }).route.id === "setting", "path route match mismatch.");
    assert(catalog.matchRouteFromLocation({ hash: "#/" }).redirected === true, "fallback route match mismatch.");
    assert(menuItems.length === 7, "menu item builder count mismatch.");
    assert(menuItems[0].title === "General" && menuItems[0].path === "/home/general", "menu item builder first item mismatch.");
    assert(menuItems[1].title === "Proxies" && menuItems[1].path === "/home/proxy", "menu item builder proxy item mismatch.");
    assert(menuItems[6].title === "Feedback" && menuItems[6].path === "/home/about", "menu item builder feedback item mismatch.");
    assert(builtRoutes.length === 2, "Vue Router route builder root count mismatch.");
    assert(builtRoutes[0].path === "/home", "Vue Router route builder parent path mismatch.");
    assert(builtRoutes[0].name === "landing-page", "Vue Router route builder parent name mismatch.");
    assert(builtRoutes[0].component === "component-42016", "Vue Router route builder parent component mismatch.");
    assert(builtRoutes[0].children.length === 9, "Vue Router route builder child count mismatch.");
    assert(builtRoutes[0].children[0].path === "general", "Vue Router route builder general path mismatch.");
    assert(builtRoutes[0].children[0].component === "component-72797", "Vue Router route builder general component mismatch.");
    assert(builtRoutes[0].children[0].meta.keepAlive === true, "Vue Router route builder keepAlive mismatch.");
    assert(!builtRoutes[0].children[3].meta, "Vue Router route builder log route should not be keepAlive.");
    assert(builtRoutes[1].redirect === "/home/general", "Vue Router route builder fallback mismatch.");
    assert(routeProbe.match.route.id === "proxy", "route readiness probe did not report the proxy route.");
    assert(routeProbe.visibleSignals.appRootPresent === true, "route readiness did not see #app.");
    assert(health.routeCatalog.routeCount === 9, "health route catalog count mismatch.");
    assert(health.readyFlags.routeReadinessProbeLoaded === true, "route readiness flag mismatch.");
    assert(health.readyFlags.storeModuleVisibilityProbeLoaded === true, "store visibility flag mismatch.");
    assert(health.readyFlags.ipcSurfacePresenceProbeLoaded === true, "IPC surface flag mismatch.");
    assert(storeProbe.vue.appRootHasVue === true, "store visibility did not observe app root Vue.");
    assert(storeProbe.vue.hasStore === true, "store visibility did not observe Vuex store.");
    assert(storeProbe.vue.storeStateKeys.includes("app"), "store visibility state keys mismatch.");
    assert(storeProbe.vue.currentRoutePath === "/home/proxy", "store visibility route path mismatch.");
    assert(ipcProbe.hasRequire === true, "IPC probe did not observe require.");
    assert(ipcProbe.electronModuleAvailable === true, "IPC probe did not observe electron module.");
    assert(ipcProbe.hasIpcRenderer === true, "IPC probe did not observe ipcRenderer.");
    assert(ipcProbe.ipcRendererMethods.join(",") === "send,invoke,on,once,removeListener,removeAllListeners", "IPC method metadata mismatch.");
    assert(patchLayer.probes.some((probe) => probe.name === "route-readiness-probe-loaded"), "route readiness load probe missing.");
    assert(patchLayer.probes.some((probe) => probe.name === "route-readiness-sample"), "route readiness sample probe missing.");
    assert(patchLayer.probes.some((probe) => probe.name === "store-module-visibility-probe-loaded"), "store visibility load probe missing.");
    assert(patchLayer.probes.some((probe) => probe.name === "ipc-surface-presence-probe-loaded"), "IPC surface load probe missing.");
    assert(scriptOrder.join(">") === [
        "renderer-patch.js",
        "runtime-smoke-probe.js",
        "renderer-readiness-probe.js",
        "route-catalog.js",
        "route-readiness-probe.js",
        "store-module-visibility-probe.js",
        "ipc-surface-presence-probe.js",
        "mock-renderer.js"
    ].join(">"), "script order mismatch.");

    console.log("Route catalog smoke check passed.");
    console.log(`Version: ${health.version}`);
    console.log(`Route count: ${catalog.routes.length}`);
    console.log(`Matched route: ${routeProbe.match.route.id}`);
    console.log(`Probe count: ${health.probeCount}`);
}

main();
