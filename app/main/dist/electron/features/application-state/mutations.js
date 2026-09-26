"use strict";

function createAppMutations({ path, connectionStatus, schedule = setTimeout }) {
    const fields = {
        CHANGE_IS_MIXIN_ENABLE: ["isMixinEnable", "isMixin"], SET_CONF_DATA: ["confData", "data"],
        CHANGE_STATUS: ["status", "status"], SET_SETTINGS_OBJECT: ["settings", "obj"],
        SAVE_SETTINGS_OBJECT: ["settings", "obj"], SET_SHOULD_USE_DARK_THEME: ["shouldUseDarkTheme", "shouldUseDarkTheme"],
        SET_DETECTED_INTERFACE_NAME: ["detectedInterfaceName", "interfaceName"], SET_IS_WINDOW_SHOW: ["isWindowShow", "isShow"],
        SET_IS_APP_SUSPEND: ["isAppSuspend", "isSuspend"], SET_INNER_SERVER_PORT: ["innerServerPort", "port"],
        SET_IS_LOCAL_MODE: ["isLocalMode", "isLocal"], SET_IS_LAUNCHING: ["isLaunching", "isLaunching"],
        SET_MENU_ITEMS: ["menuItems", "items"], SET_UPDATE_DOWNLOAD_PROGRESS: ["updateDownloadProgress", "progress"],
        SET_IS_SYSTEM_PROXY_ON: ["isSystemProxyOn", "isOn"], SET_CURRENT_ROUTE_PATH: ["currentRoutePath", "path"],
        SET_ROUTER_HIJACK_MAC_ADDRESSES: ["routerHijackMacAddresses", "addresses"], SET_CURRENT_PROFILE_PAYLOAD: ["currentProfilePayload", "payload"],
        SET_IS_SILENT_UPGRADED: ["isSilentUpgraded", "isUpgraded"], SET_TUN_SETTINGS: ["tunSettings", "settings"],
        CHANGE_IS_TUN_ENABLE: ["isTunEnable", "isTun"], SET_IS_FIREWALL_RULE_EXIST: ["isFirewallRuleExist", "isExist"],
        SET_USER_DNS: ["userDNS", "dns"], SET_MATCHED_SSID: ["matchedSSID", "ssid"]
    };
    const mutations = Object.fromEntries(Object.entries(fields).map(([name, [field, key]]) => [name, (state, payload) => { state[field] = payload[key]; }]));
    for (const [name, field] of [["SET_CLASH_PATH", "clashPath"], ["SET_PROFILES_PATH", "profilesPath"], ["SET_LOG_FILE_PATH", "logFilePath"], ["SET_EXE_PATH", "exePath"]]) {
        mutations[name] = (state, { path: value }) => { state[field] = path.normalize(value); };
    }
    return {
        ...mutations,
        SET_IS_DEV_MODE(state, { isDevMode }) { state.isDevMode = isDevMode; if (isDevMode) state.isWindowShow = true; },
        SET_CLASH_STATUS(state, { status: value }) { if ([connectionStatus.CONNECTED, connectionStatus.DISCONNECTED].includes(value)) state.clashStatus = value; },
        LOAD_PROFILES(state, { profiles }) { state.profiles = profiles; },
        SAVE_PROFILES() {},
        CHANGE_PROFILES(state, { profiles }) { state.profiles = { ...state.profiles, files: profiles }; },
        CHANGE_PROFILES_INDEX(state, { index }) { state.profiles = { ...state.profiles, index }; },
        CHANGE_PROFILE(state, { index, profile }) {
            if (!profile) return;
            const files = state.profiles.files.slice(); files[index] = profile;
            state.profiles = { ...state.profiles, files };
        },
        DELETE_PROFILE(state, { index }) { const files = state.profiles.files.slice(); files.splice(index, 1); state.profiles = { ...state.profiles, files }; },
        APPEND_PROFILE(state, { profile }) { if (profile) state.profiles = { ...state.profiles, files: [...(state.profiles.files || []), profile] }; },
        APPEND_ERROR(state, { error }) { state.errors = [...state.errors, error]; },
        ADD_AXIOS_FLYING_REQUEST_COUNT(state, { count }) { state.clashAxiosFlyingRequestCount += count; },
        SET_IS_SUB_VIEW_SHOW(state, { isShow }) { if (isShow) state.isSubViewShow = true; else schedule(() => { state.isSubViewShow = false; }, 50); },
        ADD_PROFILE_REFRESH_TIMES(state, { times = 1 }) { state.profileRefreshTimes += times; },
        CHANGE_MODE(state, { mode }) { if (["direct", "rule", "global", "script"].includes(mode)) state.mode = mode; }
    };
}

module.exports = { createAppMutations };
