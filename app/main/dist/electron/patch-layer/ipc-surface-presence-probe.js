(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var patchLayer = root.__CFW_PATCH_LAYER__;

    if (!patchLayer || typeof patchLayer.registerProbe !== "function") {
        return;
    }

    var source = "app/main/dist/electron/patch-layer/ipc-surface-presence-probe.js";

    function readIpcSurface() {
        var result = {
            source: source,
            hasRequire: typeof require === "function",
            electronModuleAvailable: false,
            hasIpcRenderer: false,
            ipcRendererMethods: [],
            processType: typeof process !== "undefined" ? process.type || null : null,
            electronVersion: typeof process !== "undefined" && process.versions ? process.versions.electron || null : null,
            contextIsolated: typeof process !== "undefined" ? process.contextIsolated === true : null,
            errorName: null
        };

        if (!result.hasRequire) {
            return result;
        }

        try {
            var electron = require("electron");
            var ipcRenderer = electron && electron.ipcRenderer;
            result.electronModuleAvailable = !!electron;
            result.hasIpcRenderer = !!ipcRenderer;

            if (ipcRenderer) {
                ["send", "invoke", "on", "once", "removeListener", "removeAllListeners"].forEach(function (method) {
                    if (typeof ipcRenderer[method] === "function") {
                        result.ipcRendererMethods.push(method);
                    }
                });
            }
        } catch (error) {
            result.errorName = error && error.name ? error.name : "Error";
        }

        return result;
    }

    if (typeof patchLayer.recordScript === "function") {
        patchLayer.recordScript("ipc-surface-presence-probe.js", {
            source: source
        });
    }

    var surface = readIpcSurface();
    patchLayer.health.ipcSurfacePresence = surface;
    patchLayer.readyFlags.ipcSurfacePresenceProbeLoaded = true;

    if (typeof patchLayer.getHealth === "function") {
        patchLayer.getHealth();
    }

    patchLayer.registerProbe("ipc-surface-presence-probe-loaded", surface);
}());
