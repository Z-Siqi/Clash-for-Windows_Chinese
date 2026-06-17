(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "009-large-ipc-settings-runtime-extraction";
    var source = "app/main/dist/electron/patch-layer/packages/ipc/dialog-ipc.js";

    function client() {
        if (!root.__CFW_IPC_CLIENT__ || typeof root.__CFW_IPC_CLIENT__.invoke !== "function") {
            throw new Error("dialog IPC package requires __CFW_IPC_CLIENT__");
        }

        return root.__CFW_IPC_CLIENT__;
    }

    function invokeDialog(ipcRenderer, method) {
        var args = Array.prototype.slice.call(arguments, 2);
        return client().invoke.apply(null, [ipcRenderer, client().channels.dialog, method].concat(args));
    }

    function showMessageBox(ipcRenderer, options) {
        return invokeDialog(ipcRenderer, "showMessageBox", options);
    }

    function showOpenDialogSync(ipcRenderer, options) {
        return invokeDialog(ipcRenderer, "showOpenDialogSync", options);
    }

    var dialogIpc = {
        version: version,
        source: source,
        invokeDialog: invokeDialog,
        showMessageBox: showMessageBox,
        showOpenDialogSync: showOpenDialogSync
    };

    root.__CFW_DIALOG_IPC__ = dialogIpc;

    if (root.__CFW_PATCH_LAYER__ && typeof root.__CFW_PATCH_LAYER__.recordScript === "function") {
        root.__CFW_PATCH_LAYER__.recordScript("packages/ipc/dialog-ipc.js", {
            source: source
        });
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = dialogIpc;
    }
}());
