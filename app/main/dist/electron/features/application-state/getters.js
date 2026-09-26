"use strict";

const { parseControllerPort, createAxiosClient, createGotClient, createWebSocketFactory } = require("../../core/network/clash-clients");
const { createClashApi } = require("../../core/network/clash-api");
const { resolveCoreBinaryPath } = require("../../core/clash-core/core-selection");

function createAppGetters({ path, platform, arch, axios, got, WebSocket, cache, keys, trim }) {
    return {
        mixedPort: state => state.confData["mixed-port"] || 0,
        controllerPort: state => parseControllerPort(state.confData["external-controller"]),
        secret: state => state.confData.secret === undefined ? "" : state.confData.secret,
        clashAxiosClient: (state, getters) => createAxiosClient({ axios, controllerPort: getters.controllerPort, secret: getters.secret }),
        clashGotClient: (state, getters) => createGotClient({ got, controllerPort: getters.controllerPort, secret: getters.secret }),
        clashWSClient: (state, getters) => createWebSocketFactory({ WebSocket, controllerPort: getters.controllerPort, secret: getters.secret }),
        clashApi: (state, getters) => createClashApi({ getClient: () => getters.clashAxiosClient }),
        resourcesPath: state => state.isDevMode || state.exePath === "" ? "" : path.join(path.dirname(state.exePath), platform === "darwin" ? "../Resources" : "./resources"),
        filesPath: (state, getters) => getters.resourcesPath !== "" ? path.join(getters.resourcesPath, "static/files") : "static/files",
        clashBinaryPath: (state, getters) => resolveCoreBinaryPath({ path, filesPath: getters.filesPath, platform, arch, coreType: state.settings.proxyCore }),
        theme(state) {
            if (Object.keys(state.settings).length === 0) return "unknown";
            return state.settings.systemTheme ? (state.shouldUseDarkTheme ? "dark" : "light") : ["light", "dark", "mc", "2077"][state.settings.theme === undefined ? 0 : state.settings.theme];
        },
        menuItemsWithOrder(state) {
            const order = cache.get(keys.MENU_ITEM_ORDER) || [];
            return [...state.menuItems].sort((left, right) => {
                const index = order.indexOf(left.title);
                return index === -1 ? 1 : index - order.indexOf(right.title);
            });
        },
        fontFamily(state) {
            const names = (state.settings.fontFamily || "").split(",").map(name => `"${trim(name, ' "')}"`);
            const fonts = `${names.join(",")}, "Microsoft Yahei", "PingFang SC", "system-ui", 微软雅黑`;
            return state.settings.useSystemEmoji ? fonts : `${fonts}, "TwemojiMozilla"`;
        }
    };
}

module.exports = { createAppGetters };
