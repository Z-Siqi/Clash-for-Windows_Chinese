"use strict";

function createCoreLifecycleClient({ ipcRenderer }) {
    let callbacks = {};
    ipcRenderer.on("core-lifecycle-event", (_event, message) => {
        if (message.type === "log") callbacks.onLogFile?.(message.value);
        else if (message.type === "ready") Promise.resolve(callbacks.onCoreReady?.()).catch(() => {});
    });
    return Object.freeze({
        async start(options) {
            callbacks = options;
            const result = await ipcRenderer.invoke("core-lifecycle", "start", {
                clashPath: options.clashPath,
                coreType: options.coreType,
                logLevel: options.logLevel,
                isLocalMode: options.isLocalMode,
                lightweightMode: options.lightweightMode
            });
            if (result.fallback) await options.onServiceFallback();
            return result;
        },
        stop: options => ipcRenderer.invoke("core-lifecycle", "stop", { lightweightMode: options.lightweightMode }),
        getStatus: () => ipcRenderer.invoke("core-lifecycle", "status")
    });
}

module.exports = { createCoreLifecycleClient };
