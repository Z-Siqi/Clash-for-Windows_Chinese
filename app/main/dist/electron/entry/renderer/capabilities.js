"use strict";

const { createSystemProxyRuntime } = require("../../features/network/system-proxy-runtime");
const { getRendererTrayIcon } = require("../../features/tray/renderer-tray-icon");
const { createAutoLaunch } = require("../../features/application/set-auto-launch");
const { removeEmoji } = require("../../core/text/remove-emoji");
const { prepareDisconnectCleanup } = require("../../features/connections/disconnect-cleanup");

function createRendererCapabilities(deps) {
    return {
        install(Vue, { store }) {
            const { status, modifyState, staticRoot, path } = deps;
            const runtime = () => deps.systemProxy || createSystemProxyRuntime({
                ...deps, filesPath: store.getters.filesPath, clashPath: store.state.app.clashPath
            });
            const publish = enabled => store.commit("CHANGE_STATUS", { status: enabled ? status.SYSTEM_PROXY : status.DEFAULT });
            Vue.prototype.$removeEmoji = removeEmoji;
            Vue.prototype.$setAutoLaunch = createAutoLaunch(deps);
            let proxyQueue = Promise.resolve();
            Vue.prototype.$setSystemProxy = enabled => {
                const apply = async () => {
                    const cleanup = await prepareDisconnectCleanup({
                        api: store.getters.clashApi, settings: store.state.app.settings,
                        disconnecting: enabled === false && store.state.app.isSystemProxyOn === true,
                        scope: "system", includeSocks: deps.platform === "darwin",
                        onError: () => deps.logger?.warn?.("Could not close all existing connections after disabling the proxy")
                    });
                    const success = await runtime().set({
                        enabled, settings: store.state.app.settings, mixedPort: store.getters.mixedPort,
                        innerServerPort: store.state.app.innerServerPort
                    });
                    if (success) publish(enabled);
                    await cleanup(success);
                    return success;
                };
                // Startup, settings watchers and quit cleanup also enter here.
                const result = proxyQueue.then(apply, apply);
                proxyQueue = result.catch(() => {});
                return result;
            };
            Vue.prototype.$getSystemProxyStatus = async () => {
                const enabled = await runtime().getStatus();
                publish(enabled);
                return enabled;
            };
            Vue.prototype.$getTrayIcon = (enabled, mode = "rule") => getRendererTrayIcon({
                path, staticRoot, clashPath: store.state.app.clashPath, settings: store.state.app.settings,
                isTun: modifyState.isTun, isMixin: modifyState.isMixin, enabled, mode
            });
        }
    };
}

module.exports = { createRendererCapabilities };
