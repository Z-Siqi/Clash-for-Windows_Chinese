"use strict";

const path = require("node:path");
const { createContextMenuBuilder } = require("../../../main/dist/electron/features/tray/build-context-menu");
const { createTrayLifecycle } = require("../../../main/dist/electron/features/tray/tray-lifecycle");

async function verifyTrayNodeMetadata({ Menu, nativeImage }) {
    const listeners = new Map(), state = { isReady: true, isShowDelayIcon: true, menuStyle: 1 };
    let resolveHealth, lifecycle, selected = 0;
    const health = new Promise(resolve => { resolveHealth = resolve; });
    const tray = { setToolTip() {}, destroy() {}, on: (event, action) => listeners.set(event, action), popUpContextMenu() {} };
    const image = nativeImage.createFromBitmap(Buffer.alloc(8 * 8 * 4, 255), { width: 8, height: 8 });
    const images = { createFromPath: () => { const icon = image.resize({ width: 8, height: 8 }); icon.setTemplateImage = () => {}; return icon; } };
    const buildContextMenu = createContextMenuBuilder({ state, path, staticRoot: "fixture", nativeImage: images,
        isLinux: () => false, localize: english => english,
        actions: { sendRenderer() {}, updateProxyIcons: items => lifecycle.updateProxyIcons(items) },
        clashApi: {
            async getProxies() { return { data: { proxies: { Auto: { type: "Selector", all: ["Fixture node"], now: "Fixture node" } } } }; },
            getProxyProviders: () => health,
            async selectProxy() { selected++; return { status: 204 }; }
        }
    });
    lifecycle = createTrayLifecycle({ ipcMain: { handle() {} }, Tray: function() { return tray; }, Menu,
        nativeImage: images, path, staticRoot: "fixture", platform: "win32", buildContextMenu, showMainWindow() {} });
    try {
        lifecycle.create(); listeners.get("right-click")();
        await new Promise(setImmediate);
        const menu = lifecycle.getOpenMenu();
        if (!menu) return false;
        const group = menu.items.find(item => item.label === "Proxy Groups").submenu.items[0];
        const node = group.submenu.items[0];
        await node.click();
        if (selected !== 1) return false;
        resolveHealth({ data: { providers: { fixture: { proxies: [{ name: "Fixture node", alive: true }] } } } });
        await new Promise(setImmediate);
        return !!node.icon && !node.icon.isEmpty() && node.icon.getSize().width === 8;
    } finally { resolveHealth({ data: { providers: {} } }); lifecycle.destroy(); }
}

module.exports = { verifyTrayNodeMetadata };
