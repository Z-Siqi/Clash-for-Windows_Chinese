"use strict";

const { normalizeRoutingMode } = require("../../core/clash-core/core-capabilities");

function createAppActions({ path, ipcRenderer }) {
    return {
        async getMode({ commit, getters }) {
            if (!getters.clashApi) return;
            const response = await getters.clashApi.getConfig().catch(() => {});
            if (response && response.status === 200) commit("CHANGE_MODE", { mode: response.data.mode });
        },
        async setMode({ commit, getters, state }, { mode }) {
            if (!getters.clashApi) return;
            const supportedMode = normalizeRoutingMode(state.settings.proxyCore, mode);
            const response = await getters.clashApi.patchConfig({ mode: supportedMode }).catch(() => {});
            if (response && response.status === 204) commit("CHANGE_MODE", { mode: supportedMode });
        },
        async getParserLogPath() { return path.join(await ipcRenderer.invoke("app", "getPath", "temp"), "cfw-parser.log"); },
        async getScriptLogPath() { return path.join(await ipcRenderer.invoke("app", "getPath", "temp"), "cfw-script.log"); }
    };
}

module.exports = { createAppActions };
