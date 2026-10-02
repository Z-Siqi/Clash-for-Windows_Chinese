"use strict";

const { createValueTools } = require("../../core/runtime/value-tools");
const { buildTunConfig } = require("../../features/tun/build-tun-config");
const { createNativeActions } = require("../../features/renderer-ui/native-actions");

function createRendererUtilities(deps) {
    const { path, store, cache, keys, ipcRenderer } = deps;
    let previousVersion = null;
    const values = createValueTools(deps);
    return {
        ...values,
        ...createNativeActions({ ...deps, getSettings: () => store.state.app.settings }),
        buildTunConfig,
        async updateYaml(file, key, value) {
            if (path.resolve(file) !== path.resolve(store.state.app.clashPath, "config.yaml")) throw new Error("Unsupported renderer configuration file");
            return deps.updateConfig(key, value);
        },
        async isNewVersion() {
            const current = await ipcRenderer.invoke("app", "getVersion");
            if (previousVersion === null) {
                previousVersion = cache.get(keys.LAST_VERSION_CODE) || "";
                cache.put(keys.LAST_VERSION_CODE, current);
            }
            return previousVersion !== current;
        },
        async queryDns(name, type) {
            const api = store && store.getters && store.getters.clashApi;
            if (!api || !api.isReady()) throw new Error("Clash Core is not ready");
            const response = await api.queryDns(name, type);
            return response == null ? undefined : response.data;
        }
    };
}

module.exports = { createRendererUtilities };
