(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "009-large-ipc-settings-runtime-extraction";
    var source = "app/main/dist/electron/patch-layer/packages/ipc/window-ipc.js";

    function client() {
        if (!root.__CFW_IPC_CLIENT__ || typeof root.__CFW_IPC_CLIENT__.invokeWindow !== "function") {
            throw new Error("window IPC package requires __CFW_IPC_CLIENT__");
        }

        return root.__CFW_IPC_CLIENT__;
    }

    function invokeWindow(ipcRenderer, method) {
        var args = Array.prototype.slice.call(arguments, 2);
        return client().invokeWindow.apply(null, [ipcRenderer, method].concat(args));
    }

    function invokeWindowControl(ipcRenderer, method) {
        var args = Array.prototype.slice.call(arguments, 2);
        return client().invoke.apply(null, [ipcRenderer, client().channels.windowControl, method].concat(args));
    }

    function setFullScreen(ipcRenderer, value) {
        return invokeWindow(ipcRenderer, "setFullScreen", value);
    }

    function setAlwaysOnTop(ipcRenderer, value) {
        return invokeWindow(ipcRenderer, "setAlwaysOnTop", value);
    }

    function isMaximized(ipcRenderer) {
        return invokeWindow(ipcRenderer, "isMaximized");
    }

    function isVisible(ipcRenderer) {
        return invokeWindow(ipcRenderer, "isVisible");
    }

    function reload(ipcRenderer) {
        return invokeWindow(ipcRenderer, "reload");
    }

    function close(ipcRenderer) {
        return invokeWindow(ipcRenderer, "close");
    }

    function show(ipcRenderer) {
        return invokeWindowControl(ipcRenderer, "show");
    }

    function showOrHide(ipcRenderer) {
        return invokeWindowControl(ipcRenderer, "show-or-hide");
    }

    var windowIpc = {
        version: version,
        source: source,
        invokeWindow: invokeWindow,
        invokeWindowControl: invokeWindowControl,
        setFullScreen: setFullScreen,
        setAlwaysOnTop: setAlwaysOnTop,
        isMaximized: isMaximized,
        isVisible: isVisible,
        reload: reload,
        close: close,
        show: show,
        showOrHide: showOrHide
    };

    root.__CFW_WINDOW_IPC__ = windowIpc;

    if (root.__CFW_PATCH_LAYER__ && typeof root.__CFW_PATCH_LAYER__.recordScript === "function") {
        root.__CFW_PATCH_LAYER__.recordScript("packages/ipc/window-ipc.js", {
            source: source
        });
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = windowIpc;
    }
}());
