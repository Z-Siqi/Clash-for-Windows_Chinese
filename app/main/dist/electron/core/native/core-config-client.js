"use strict";

function createCoreConfigClient({ ipcRenderer, shouldReplaceWintun }) {
    let sequence = Date.now() * 1000;
    async function call(operation, request) {
        const result = await ipcRenderer.invoke("core-config", operation, request);
        if (!result || result.ok !== true) throw new Error(result?.error || "Core configuration operation failed");
        return result.value;
    }
    return Object.freeze({
        load: home => call("load", { home }),
        metadata: home => call("metadata", { home }),
        reset: home => call("reset", { home }),
        update: (home, key, value) => call("update-value", { home, key, value }),
        async updateGeoip(home, { url, token }, onProgress) {
            const id = ++sequence;
            const progress = (_event, value) => { if (value.id === id) onProgress(value.percent); };
            ipcRenderer.on("geoip-progress", progress);
            try { return await call("update-geoip", { home, id, url, token }); }
            finally { ipcRenderer.removeListener("geoip-progress", progress); }
        },
        startPac: home => call("start-pac", { home }),
        async initialize(home) {
            return call("initialize", { home, replaceWintun: await shouldReplaceWintun() });
        },
        async randomizePorts({ clashPath, devMode, lightweightMode, onChange }) {
            const value = await call("randomize-ports", { home: clashPath, devMode, lightweightMode });
            onChange(value);
        }
    });
}

module.exports = { createCoreConfigClient };
