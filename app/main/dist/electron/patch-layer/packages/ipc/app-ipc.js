(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "009-large-ipc-settings-runtime-extraction";
    var source = "app/main/dist/electron/patch-layer/packages/ipc/app-ipc.js";

    function client() {
        if (!root.__CFW_IPC_CLIENT__ || typeof root.__CFW_IPC_CLIENT__.invokeApp !== "function") {
            throw new Error("app IPC package requires __CFW_IPC_CLIENT__");
        }

        return root.__CFW_IPC_CLIENT__;
    }

    function invoke(ipcRenderer, method) {
        var args = Array.prototype.slice.call(arguments, 2);
        return client().invokeApp.apply(null, [ipcRenderer, method].concat(args));
    }

    function getPath(ipcRenderer, name) {
        return invoke(ipcRenderer, "getPath", name);
    }

    function getVersion(ipcRenderer) {
        return invoke(ipcRenderer, "getVersion");
    }

    function getName(ipcRenderer) {
        return invoke(ipcRenderer, "getName");
    }

    function getAppPath(ipcRenderer) {
        return invoke(ipcRenderer, "getAppPath");
    }

    function isPackaged(ipcRenderer) {
        return invoke(ipcRenderer, "isPackaged");
    }

    function setLoginItemSettings(ipcRenderer, settings) {
        return invoke(ipcRenderer, "setLoginItemSettings", settings);
    }

    function relaunch(ipcRenderer) {
        return invoke(ipcRenderer, "relaunch");
    }

    function exit(ipcRenderer, code) {
        return invoke(ipcRenderer, "exit", code);
    }

    function invokeBatch(ipcRenderer, methodArgsList) {
        return methodArgsList.map(function (methodArgs) {
            return invoke.apply(null, [ipcRenderer].concat(methodArgs));
        });
    }

    var appIpc = {
        version: version,
        source: source,
        invoke: invoke,
        invokeBatch: invokeBatch,
        getPath: getPath,
        getVersion: getVersion,
        getName: getName,
        getAppPath: getAppPath,
        isPackaged: isPackaged,
        setLoginItemSettings: setLoginItemSettings,
        relaunch: relaunch,
        exit: exit
    };

    root.__CFW_APP_IPC__ = appIpc;

    if (root.__CFW_PATCH_LAYER__ && typeof root.__CFW_PATCH_LAYER__.recordScript === "function") {
        root.__CFW_PATCH_LAYER__.recordScript("packages/ipc/app-ipc.js", {
            source: source
        });
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = appIpc;
    }
}());
