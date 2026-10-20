"use strict";
const { normalizeCoreType } = require("../../core/clash-core/core-selection");
const { resolveTapMode } = require("../../core/network/legacy-tap-policy");

const DEFAULT_TRAY_ORDERS = [["icon"], ["status", "traffic", "text"]];

function mergeSettings(settings = {}) {
    const { legacyTapEnabled: _legacyTapEnabled, ...saved } = settings;
    return {
        ...saved,
        showNewVersionIcon: settings.showNewVersionIcon !== false,
        hideAfterStartup: settings.hideAfterStartup === true,
        randomControllerPort: settings.randomControllerPort !== false,
        runTimeFormat: settings.runTimeFormat || "hh : mm : ss",
        trayOrders: settings.trayOrders || cloneDefaultTrayOrders(),
        hideTrayIcon: settings.hideTrayIcon === true,
        connShowProcess: settings.connShowProcess !== false,
        connProxyDisconnect: settings.connProxyDisconnect !== false,
        legacyTapMode: resolveTapMode(settings),
        showTrayProxyDelayIndicator:
            settings.showTrayProxyDelayIndicator !== false,
        checkForUpdates: settings.checkForUpdates !== false,
        disableLoadingAdsLink: settings.disableLoadingAdsLink !== false,
        allowRemoteProfileParsers: settings.allowRemoteProfileParsers === true,
        allowHttpExternalLinks: settings.allowHttpExternalLinks === true,
        proxyCore: normalizeCoreType(settings.proxyCore)
    };
}

function cloneDefaultTrayOrders() {
    return DEFAULT_TRAY_ORDERS.map(group => [...group]);
}

module.exports = { mergeSettings };
