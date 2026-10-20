"use strict";

const { createTrayState } = require("../../../main/dist/electron/features/tray/tray-state");
const { buildStaticTrayMenu } = require("../../../main/dist/electron/features/tray/build-static-tray-menu");
const { createTrayProxyProgress } = require("../../../main/dist/electron/features/tray/proxy-operation-progress");

function verifyTrayProgress({ Menu, nativeImage }) {
    const state = { ...createTrayState(), isReady: true, tunModeChecked: true };
    const requests = [];
    let progress, tick;
    const actions = { requestProxyOperation: (...args) => progress.request(...args), getProxyProgressIcon: () => progress?.getIcon() };
    const menu = buildStaticTrayMenu({ Menu, locale: "en", state, actions });
    progress = createTrayProxyProgress({ state, nativeImage, getMenus: () => [menu], refreshMenu() {},
        sendRenderer: (...args) => requests.push(args), repeat: callback => { tick = callback; return 1; }, cancel() {} });
    try {
        menu.getMenuItemById("tun").click({ checked: false });
        const item = menu.getMenuItemById("tun-pending");
        const firstFrame = item.icon.toPNG();
        for (let i = 0; i < 100; i++) menu.getMenuItemById("mixin").click({ checked: true });
        const pending = item.visible && !item.enabled && !item.icon.isEmpty() && item.icon.getSize().width === 16
            && !menu.getMenuItemById("tun").visible && !menu.getMenuItemById("mixin").enabled && requests.length === 1;
        tick();
        const animated = !firstFrame.equals(item.icon.toPNG());
        progress.update({ busy: false, operation: "", target: null, requestId: requests[0][2] });
        return pending && animated && !item.visible && menu.getMenuItemById("tun").checked && menu.getMenuItemById("mixin").enabled;
    } finally { progress.update({ busy: false, operation: "", target: null, requestId: requests[0]?.[2] }); }
}

module.exports = { verifyTrayProgress };
