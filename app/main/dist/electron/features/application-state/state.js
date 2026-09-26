"use strict";

function createAppState({ connectionStatus, proxyStatus, cache, keys, labels }) {
    return {
        isDevMode: false, clashPath: "", clashStatus: connectionStatus.DISCONNECTED,
        profilesPath: "", profiles: {}, confData: {},
        logFilePath: cache.get(keys.LAST_LOG_FILE_PATH) || "",
        isMixinEnable: cache.get(keys.IS_MIXIN) || false,
        exePath: "", errors: [], status: proxyStatus.INIT,
        clashAxiosFlyingRequestCount: 0, settings: {}, shouldUseDarkTheme: false,
        detectedInterfaceName: cache.get(keys.DETECTED_INTERFACE_NAME) || "",
        isWindowShow: false, isAppSuspend: false, innerServerPort: 0,
        isLocalMode: true, isLaunching: true,
        menuItems: [["general", "general"], ["proxies", "proxy"], ["profiles", "server"], ["logs", "log"],
            ["connections", "connection"], ["settings", "setting"], ["feedback", "about"]]
            .map(([label, route]) => ({ title: labels[label](), path: `/home/${route}` })),
        updateDownloadProgress: null, isSystemProxyOn: cache.get(keys.SYSTEM_PROXY) || false,
        isSubViewShow: false, currentRoutePath: cache.get(keys.CURRENT_ROUTE_PATH) || "/home/general",
        profileRefreshTimes: 0, mode: "rule", routerHijackMacAddresses: cache.get(keys.ROUTER_HIJACK_MAC_ADDRESSES) || [],
        currentProfilePayload: {}, isSilentUpgraded: false, tunSettings: cache.get(keys.TUN_SETTINGS),
        isTunEnable: cache.get(keys.IS_TUN) || false, isFirewallRuleExist: false, userDNS: null, matchedSSID: ""
    };
}

module.exports = { createAppState };
