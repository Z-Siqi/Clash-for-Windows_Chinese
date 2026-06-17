(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "009-large-ipc-settings-runtime-extraction";
    var source = "app/main/dist/electron/patch-layer/packages/ipc/ipc-client.js";

    var channels = {
        app: "app",
        window: "window",
        windowControl: "window-control",
        dialog: "dialog",
        globalShortcut: "globalShortcut",
        nativeTheme: "nativeTheme",
        powerSaveBlocker: "powerSaveBlocker",
        webContent: "webContent"
    };

    function assertInvoker(ipcRenderer) {
        if (!ipcRenderer || typeof ipcRenderer.invoke !== "function") {
            throw new Error("ipc client requires ipcRenderer.invoke");
        }
    }

    function invoke(ipcRenderer, channel, method) {
        assertInvoker(ipcRenderer);

        var args = Array.prototype.slice.call(arguments, 3);
        return ipcRenderer.invoke.apply(ipcRenderer, [channel, method].concat(args));
    }

    function invokeWindow(ipcRenderer, method) {
        var args = Array.prototype.slice.call(arguments, 2);
        return invoke.apply(null, [ipcRenderer, channels.window, method].concat(args));
    }

    function invokeApp(ipcRenderer, method) {
        var args = Array.prototype.slice.call(arguments, 2);
        return invoke.apply(null, [ipcRenderer, channels.app, method].concat(args));
    }

    var ipcClient = {
        version: version,
        source: source,
        channels: channels,
        invoke: invoke,
        invokeWindow: invokeWindow,
        invokeApp: invokeApp
    };

    root.__CFW_IPC_CLIENT__ = ipcClient;

    if (root.__CFW_PATCH_LAYER__ && typeof root.__CFW_PATCH_LAYER__.recordScript === "function") {
        root.__CFW_PATCH_LAYER__.recordScript("packages/ipc/ipc-client.js", {
            source: source,
            channels: Object.keys(channels)
        });
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = ipcClient;
    }
}());
