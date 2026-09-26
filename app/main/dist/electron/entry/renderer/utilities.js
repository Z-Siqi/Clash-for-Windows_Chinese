"use strict";

const { createValueTools } = require("../../core/runtime/value-tools");
const { updateYamlValue } = require("../../core/storage/yaml-file");
const { buildTunConfig } = require("../../features/tun/build-tun-config");
const { createNativeActions } = require("../../features/renderer-ui/native-actions");

function createRendererUtilities(deps) {
    const { fs, path, yaml, store, cache, keys, ipcRenderer } = deps;
    let previousVersion = null;
    function removeDirectory(directory) {
        if (!fs.existsSync(directory)) return;
        for (const name of fs.readdirSync(directory)) {
            const file = path.join(directory, name);
            if (fs.lstatSync(file).isDirectory()) removeDirectory(file);
            else fs.unlinkSync(file);
        }
        fs.rmdirSync(directory);
    }
    const values = createValueTools(deps);
    return {
        ...values,
        ...createNativeActions({ ...deps, getSettings: () => store.state.app.settings }),
        removeDirectory,
        buildTunConfig,
        async updateYaml(file, key, value) { updateYamlValue({ fs, path, yaml, file, key, value }); },
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
