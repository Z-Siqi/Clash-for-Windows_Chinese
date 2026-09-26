"use strict";

const { normalizeCoreType } = require("../../core/clash-core/core-selection");
const { supportsScriptMode } = require("../../core/clash-core/core-capabilities");

const MODE_IDS = ["global", "rule", "direct", "script"];

function createTrayState() {
    return {
        systemProxyChecked: false,
        tunModeChecked: false,
        mixinChecked: false,
        isReady: false,
        menuMode: "",
        menuStyle: 0,
        isShowDelayIcon: false,
        language: 0,
        coreType: "clash"
    };
}

function registerTrayStateIpc({
    ipcMain,
    state,
    isLinux,
    getLocalizedMenu,
    getMenus,
    refreshMenu,
    showMainWindow
}) {
    ipcMain.on("clash-core-status-change", function(_event, coreStatus) {
        state.isReady = true;
        if (isLinux()) {
            const menu = getLocalizedMenu();
            setEnabled(menu, "system-proxy", coreStatus !== 1);
            setEnabled(menu, "mixin", coreStatus !== 1);
            setEnabled(menu, "tun", coreStatus !== 1);
            for (const mode of MODE_IDS) {
                setEnabled(menu, `mode-${mode}`, coreStatus !== 1 && (mode !== "script" || supportsScriptMode(state.coreType)));
            }
            refreshMenu();
        }
    });
    ipcMain.handle("tray-proxies-style", function(_event, style) {
        state.menuStyle = style === 0 ? 1 : style === 1 ? 0 : 2;
    });
    ipcMain.handle("tray-proxies-icon", function(_event, isVisible) {
        state.isShowDelayIcon = isVisible;
    });
    ipcMain.on("mode-changed", function(_event, mode) {
        if (mode === "script" && !supportsScriptMode(state.coreType)) return;
        state.menuMode = mode;
        if (isLinux()) {
            const item = getLocalizedMenu().getMenuItemById(`mode-${mode}`);
            if (item) item.checked = true;
            refreshMenu();
        }
    });
    ipcMain.handle("cfw-language", function(_event, language) {
        state.language = language;
    });
    ipcMain.on("core-type-changed", function(_event, coreType) {
        state.coreType = normalizeCoreType(coreType);
        if (!supportsScriptMode(state.coreType) && state.menuMode === "script") state.menuMode = "rule";
        const menus = getMenus ? getMenus() : [getLocalizedMenu()];
        for (const menu of menus) {
            setVisible(menu, "mode-script", supportsScriptMode(state.coreType));
            setChecked(menu, "mode-script", state.menuMode === "script");
            setChecked(menu, "mode-rule", state.menuMode === "rule");
        }
        refreshMenu();
    });
    ipcMain.on("system-proxy-changed", function(_event, checked) {
        state.systemProxyChecked = checked;
    });
    ipcMain.on("mixin-changed", function(_event, checked) {
        state.mixinChecked = checked;
        updateCheckedItem("mixin", checked);
    });
    ipcMain.on("tun-changed", function(_event, checked) {
        state.tunModeChecked = checked;
        updateCheckedItem("tun", checked);
    });
    ipcMain.on("enhanced-tray-click", showMainWindow);

    function updateCheckedItem(id, checked) {
        if (isLinux()) {
            const item = getLocalizedMenu().getMenuItemById(id);
            if (item) item.checked = checked;
            refreshMenu();
        }
    }
}

function setEnabled(menu, id, enabled) {
    const item = menu.getMenuItemById(id);
    if (item) item.enabled = enabled;
}

function setVisible(menu, id, visible) {
    const item = menu.getMenuItemById(id);
    if (item) item.visible = visible;
}

function setChecked(menu, id, checked) {
    const item = menu.getMenuItemById(id);
    if (item) item.checked = checked;
}

module.exports = { createTrayState, registerTrayStateIpc };
