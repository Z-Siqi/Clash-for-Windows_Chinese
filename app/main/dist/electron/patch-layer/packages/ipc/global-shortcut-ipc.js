(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "009-large-ipc-settings-runtime-extraction";
    var source = "app/main/dist/electron/patch-layer/packages/ipc/global-shortcut-ipc.js";

    function client() {
        if (!root.__CFW_IPC_CLIENT__ || typeof root.__CFW_IPC_CLIENT__.invoke !== "function") {
            throw new Error("global shortcut IPC package requires __CFW_IPC_CLIENT__");
        }

        return root.__CFW_IPC_CLIENT__;
    }

    function invoke(ipcRenderer, method) {
        var args = Array.prototype.slice.call(arguments, 2);
        return client().invoke.apply(null, [ipcRenderer, client().channels.globalShortcut, method].concat(args));
    }

    function register(ipcRenderer, accelerator) {
        return invoke(ipcRenderer, "register", accelerator);
    }

    function unregister(ipcRenderer, accelerator) {
        return invoke(ipcRenderer, "unregister", accelerator);
    }

    function isRegistered(ipcRenderer, accelerator) {
        return invoke(ipcRenderer, "isRegistered", accelerator);
    }

    var globalShortcutIpc = {
        version: version,
        source: source,
        invoke: invoke,
        register: register,
        unregister: unregister,
        isRegistered: isRegistered
    };

    root.__CFW_GLOBAL_SHORTCUT_IPC__ = globalShortcutIpc;

    if (root.__CFW_PATCH_LAYER__ && typeof root.__CFW_PATCH_LAYER__.recordScript === "function") {
        root.__CFW_PATCH_LAYER__.recordScript("packages/ipc/global-shortcut-ipc.js", {
            source: source
        });
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = globalShortcutIpc;
    }
}());
