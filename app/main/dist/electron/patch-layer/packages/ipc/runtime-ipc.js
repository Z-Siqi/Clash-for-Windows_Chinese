(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "009-large-ipc-settings-runtime-extraction";
    var source = "app/main/dist/electron/patch-layer/packages/ipc/runtime-ipc.js";

    function client() {
        if (!root.__CFW_IPC_CLIENT__ || typeof root.__CFW_IPC_CLIENT__.invoke !== "function") {
            throw new Error("runtime IPC package requires __CFW_IPC_CLIENT__");
        }

        return root.__CFW_IPC_CLIENT__;
    }

    function invoke(ipcRenderer, channel, method) {
        var args = Array.prototype.slice.call(arguments, 3);
        return client().invoke.apply(null, [ipcRenderer, channel, method].concat(args));
    }

    function shouldUseDarkColors(ipcRenderer) {
        return invoke(ipcRenderer, client().channels.nativeTheme, "shouldUseDarkColors");
    }

    function startPowerSaveBlocker(ipcRenderer, type) {
        return invoke(ipcRenderer, client().channels.powerSaveBlocker, "start", type);
    }

    function stopPowerSaveBlocker(ipcRenderer, id) {
        return invoke(ipcRenderer, client().channels.powerSaveBlocker, "stop", id);
    }

    function toggleDevTools(ipcRenderer) {
        return invoke(ipcRenderer, client().channels.webContent, "toggleDevTools");
    }

    var runtimeIpc = {
        version: version,
        source: source,
        invoke: invoke,
        shouldUseDarkColors: shouldUseDarkColors,
        startPowerSaveBlocker: startPowerSaveBlocker,
        stopPowerSaveBlocker: stopPowerSaveBlocker,
        toggleDevTools: toggleDevTools
    };

    root.__CFW_RUNTIME_IPC__ = runtimeIpc;

    if (root.__CFW_PATCH_LAYER__ && typeof root.__CFW_PATCH_LAYER__.recordScript === "function") {
        root.__CFW_PATCH_LAYER__.recordScript("packages/ipc/runtime-ipc.js", {
            source: source
        });
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = runtimeIpc;
    }
}());
