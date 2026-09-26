"use strict";

const { createAppState } = require("../../features/application-state/state");
const { createAppGetters } = require("../../features/application-state/getters");
const { createAppMutations } = require("../../features/application-state/mutations");
const { createAppActions } = require("../../features/application-state/actions");
const { createSettingsRepository } = require("../../features/settings/settings-repository");
const { createProfilesRepository } = require("../../features/profiles/profiles-repository");

function createRendererAppModule(deps) {
    const { cache, keys, modifyState, ipcRenderer, labels } = deps;
    if (modifyState.language === -1) {
        modifyState.language = cache.get("language") == null ? 0 : cache.get("language");
        ipcRenderer.invoke("cfw-language", modifyState.language);
        modifyState.isTun = cache.get(keys.IS_TUN);
        modifyState.isMixin = cache.get(keys.IS_MIXIN);
    }
    const settings = createSettingsRepository(deps);
    const profiles = createProfilesRepository(deps);
    const base = createAppMutations(deps);
    const mutations = { ...base };
    mutations.LOAD_PROFILES = state => base.LOAD_PROFILES(state, { profiles: profiles.load(state.profilesPath) });
    mutations.SAVE_PROFILES = state => profiles.save(state.profilesPath, state.profiles);
    mutations.SAVE_SETTINGS_OBJECT = (state, payload) => {
        settings.save(state.clashPath, payload.obj);
        base.SAVE_SETTINGS_OBJECT(state, payload);
    };
    for (const name of ["CHANGE_PROFILES", "CHANGE_PROFILES_INDEX", "CHANGE_PROFILE", "APPEND_PROFILE", "DELETE_PROFILE"]) {
        mutations[name] = (state, payload) => {
            // Persist before publishing to Vue: failed writes leave the visible state intact.
            const next = { ...state };
            base[name](next, payload);
            profiles.save(state.profilesPath, next.profiles);
            state.profiles = next.profiles;
        };
    }
    const cached = {
        SET_LOG_FILE_PATH: ["logFilePath", "LAST_LOG_FILE_PATH"],
        SET_DETECTED_INTERFACE_NAME: ["detectedInterfaceName", "DETECTED_INTERFACE_NAME"],
        SET_CURRENT_ROUTE_PATH: ["currentRoutePath", "CURRENT_ROUTE_PATH"],
        SET_ROUTER_HIJACK_MAC_ADDRESSES: ["routerHijackMacAddresses", "ROUTER_HIJACK_MAC_ADDRESSES"],
        SET_TUN_SETTINGS: ["tunSettings", "TUN_SETTINGS"],
        SET_IS_SYSTEM_PROXY_ON: ["isSystemProxyOn", "SYSTEM_PROXY", true],
        CHANGE_IS_TUN_ENABLE: ["isTunEnable", "IS_TUN", true, "isTun"],
        CHANGE_IS_MIXIN_ENABLE: ["isMixinEnable", "IS_MIXIN", true, "isMixin"]
    };
    for (const [name, [field, key, ssidScoped, mirror]] of Object.entries(cached)) {
        mutations[name] = (state, payload) => {
            const next = { ...state };
            base[name](next, payload);
            if (!ssidScoped || state.matchedSSID === "") cache.put(keys[key], next[field]);
            state[field] = next[field];
            if (mirror) modifyState[mirror] = next[field];
        };
    }
    return {
        state: createAppState({ ...deps, labels }),
        getters: createAppGetters(deps), mutations, actions: createAppActions(deps)
    };
}

function createRendererStore({ Vue, Vuex, modules }) {
    Vue.use(Vuex);
    // Existing UI writes nested data directly; retain compatibility until page migration.
    return new Vuex.Store({ modules, strict: false });
}

module.exports = { createRendererAppModule, createRendererStore };
