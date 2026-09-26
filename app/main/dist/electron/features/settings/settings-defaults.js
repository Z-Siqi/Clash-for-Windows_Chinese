"use strict";

const DEFAULT_TRAY_ORDERS = [["icon"], ["status", "traffic", "text"]];

function mergeSettings(settings = {}) {
    return {
        ...settings,
        showNewVersionIcon: settings.showNewVersionIcon !== false,
        hideAfterStartup: settings.hideAfterStartup === true,
        randomControllerPort: settings.randomControllerPort !== false,
        runTimeFormat: settings.runTimeFormat || "hh : mm : ss",
        trayOrders: settings.trayOrders || cloneDefaultTrayOrders(),
        hideTrayIcon: settings.hideTrayIcon === true,
        connShowProcess: settings.connShowProcess !== false,
        connProxyDisconnect: settings.connProxyDisconnect !== false,
        showTrayProxyDelayIndicator:
            settings.showTrayProxyDelayIndicator !== false,
        checkForUpdates: settings.checkForUpdates !== false,
        disableLoadingAdsLink: settings.disableLoadingAdsLink !== false,
        allowRemoteProfileParsers: settings.allowRemoteProfileParsers === true,
        proxyCore: settings.proxyCore === "clash" ? "clash" : "mihomo"
    };
}

function cloneDefaultTrayOrders() {
    return DEFAULT_TRAY_ORDERS.map(group => [...group]);
}

module.exports = { mergeSettings };
