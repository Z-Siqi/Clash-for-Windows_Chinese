"use strict";

const axios = require("axios");
const BigNumber = require("bignumber.js");
const lodash = require("lodash");
const moment = require("moment");
const mousetrap = require("mousetrap");
const cron = require("unix-cron");
const yaml = require("yaml");

const { createPlatform } = require("../../core/runtime/platform");
const { createIntervalScheduler } = require("../../core/runtime/interval-scheduler");
const { createClipboardClient } = require("../../core/native/clipboard-client");
const { createNativeAdminClient } = require("../../core/native/native-admin-client");
const { createJsonCache } = require("../../core/storage/json-cache");
const { randomUuid } = require("../../core/crypto/browser-uuid");
const { md5 } = require("../../core/crypto/md5");
const { createBrowserPath } = require("../../core/runtime/browser-path");
const net = require("../../core/network/browser-ip");
const { createApplicationLogClient } = require("../../core/native/application-log-client");
const { createPublicContentClient } = require("../../core/native/public-content-client");
const { createRendererAppModule, createRendererStore } = require("./create-renderer-store");
const { createRendererUtilities } = require("./utilities");
const { connectionStatus, proxyStatus } = require("../../features/application-state/status");
const { createNetworkInfoClient } = require("../../core/native/network-info-client");
const { createCoreLifecycleClient } = require("../../core/native/core-lifecycle-client");
const { createRepositoryClients } = require("../../core/native/repository-client");
const { createCoreConfigClient } = require("../../core/native/core-config-client");
const { createClashApiClient } = require("../../core/native/clash-api-client");
const { createCoreStreamClient } = require("../../core/native/core-stream-client");
const { createTunClient } = require("../../core/native/tun-client");
const { createExternalEditorClient } = require("../../core/native/external-editor-client");
const { createDhcpClient } = require("../../core/native/dhcp-client");
const { createProviderFileClient } = require("../../core/native/provider-file-client");
const { getDefaultBypass, defaultPac } = require("../../features/network/proxy-defaults");
const { createProfileDownloadClient } = require("../../core/native/profile-download-client");
const { PROFILE_SCRIPT, PROXY_SCRIPT, createUserScriptClient } = require("../../core/native/user-script-client");
const { createServiceModeClient } = require("../../core/native/service-mode-client");

function createRendererRuntime({
    Vue,
    Vuex,
    Language,
    modifyState,
    windowObject,
    staticRoot,
    processObject = process,
    electronHost = require("electron")
}) {
    const platform = createPlatform(processObject);
    const path = createBrowserPath({ platform: processObject.platform, cwd: processObject.cwd?.() || staticRoot });
    const uuid = () => randomUuid(windowObject.crypto);
    const cache = createJsonCache(windowObject.localStorage);
    const preferenceKeys = require("../../features/settings/preference-keys").preferenceKeys;
    const electron = Object.assign({}, electronHost, {
        clipboard: createClipboardClient(electronHost.ipcRenderer),
        shell: { openExternal: url => electronHost.ipcRenderer.invoke("external-navigation", url) }
    });
    const logger = createApplicationLogClient({ ipcRenderer: electron.ipcRenderer });
    let store;
    const repositories = createRepositoryClients({ ipcRenderer: electron.ipcRenderer, getHome: () => store.state.app.clashPath });
    const controllerApi = createClashApiClient({
        ipcRenderer: electron.ipcRenderer,
        isReady: () => Boolean(store && store.getters.controllerPort > 0),
        onRequestChange: count => store.commit("ADD_AXIOS_FLYING_REQUEST_COUNT", { count })
    });
    const controllerStreams = createCoreStreamClient({ ipcRenderer: electron.ipcRenderer, isReady: controllerApi.isReady });
    const appModule = createRendererAppModule({
        path,
        yaml,
        axios,
        trim: lodash.trim,
        platform: processObject.platform,
        arch: processObject.arch,
        cache,
        keys: preferenceKeys,
        connectionStatus,
        proxyStatus,
        ipcRenderer: electron.ipcRenderer,
        modifyState,
        labels: new Language(cache.get("language")),
        settingsRepository: repositories.settings,
        profilesRepository: repositories.profiles,
        controllerApi,
        controllerStreams
    });
    store = createRendererStore({ Vue, Vuex, modules: { app: appModule } });
    const utilities = createRendererUtilities({
        updateConfig: (key, value) => coreConfigRepository.update(store.state.app.clashPath, key, value),
        path,
        yaml,
        hashText: md5,
        BigNumber,
        store,
        ipcRenderer: electron.ipcRenderer,
        shell: electron.shell,
        Notification: windowObject.Notification,
        getLanguage: () => modifyState.language,
        cache,
        keys: preferenceKeys
    });
    const scheduler = createIntervalScheduler({
        isActive: () => store.state.app.isWindowShow,
        createId: lodash.uniqueId
    });
    const nativeAdmin = createNativeAdminClient({
        ipcRenderer: electron.ipcRenderer,
        getBinaryPath: () => store.getters.clashBinaryPath,
        getClashPath: () => store.state.app.clashPath,
        getFilesPath: () => store.getters.filesPath
    });
    const firewall = nativeAdmin.firewall;
    const serviceModule = createServiceModeClient({ service: nativeAdmin.service });
    const runMacSystemProxyCommand = args => {
        if (args[0] !== "-dns") return Promise.reject(new Error("Unsupported DNS operation"));
        if (args[1] === "query") return nativeAdmin.dns.query();
        if (args[1] === "reset") return nativeAdmin.dns.reset();
        return nativeAdmin.dns.set(String(args[1]).split(","));
    };
    const profileParser = createProfileDownloadClient({
        store, ipcRenderer: electron.ipcRenderer, getLanguage: () => modifyState.language
    });
    const userScriptRunner = createUserScriptClient({
        ipcRenderer: electron.ipcRenderer, getHome: () => store.state.app.clashPath,
        onError: () => utilities.notify("Script", "User script failed")
    });
    const networkInfo = createNetworkInfoClient({ ipcRenderer: electron.ipcRenderer });
    const coreLifecycle = createCoreLifecycleClient({ ipcRenderer: electron.ipcRenderer });
    const coreConfigRepository = createCoreConfigClient({ ipcRenderer: electron.ipcRenderer, shouldReplaceWintun: utilities.isNewVersion });

    return {
        axios,
        cache,
        cron,
        coreLifecycle,
        coreConfigRepository,
        defaultBypass: getDefaultBypass(processObject.platform),
        defaultPac,
        downloadProfile: profileParser.downloadProfile,
        electron,
        firewall,
        getPort: () => electron.ipcRenderer.invoke("loopback-port", "random"),
        checkPort: port => electron.ipcRenderer.invoke("loopback-port", "available", port),
        ...networkInfo,
        keys: preferenceKeys,
        lodash,
        logger,
        moment,
        mousetrap,
        net,
        path,
        platform,
        processObject,
        profileParser,
        settingsRepository: repositories.settings,
        profilesRepository: repositories.profiles,
        runMacSystemProxyCommand,
        scheduler,
        scripts: { profileScriptType: PROFILE_SCRIPT, proxyScriptType: PROXY_SCRIPT, run: userScriptRunner.run },
        serviceModule,
        systemProxy: nativeAdmin.systemProxy,
        profileNetworkEffects: nativeAdmin.profileNetworkEffects,
        terminal: nativeAdmin.terminal,
        runMixin: payload => electron.ipcRenderer.invoke("user-script", {
            home: store.state.app.clashPath, scriptType: "mixin", payload
        }),
        runTrayScript: () => electron.ipcRenderer.invoke("user-script", {
            home: store.state.app.clashPath, scriptType: "tray"
        }),
        startUserProcesses: () => electron.ipcRenderer.invoke("user-processes-start", store.state.app.clashPath),
        validateMixinCode: source => electron.ipcRenderer.invoke("mixin-code-validate", source),
        externalEditor: createExternalEditorClient({ ipcRenderer: electron.ipcRenderer, getHome: () => store.state.app.clashPath }),
        dhcpService: createDhcpClient({ ipcRenderer: electron.ipcRenderer }),
        providerFiles: createProviderFileClient({ ipcRenderer: electron.ipcRenderer, getHome: () => store.state.app.clashPath }),
        publicContent: createPublicContentClient({ ipcRenderer: electron.ipcRenderer }),
        readCoreLog: lineCount => electron.ipcRenderer.invoke("core-log-read", lineCount),
        openCoreLog: folder => electron.ipcRenderer.invoke("core-log-open", folder),
        openApplicationLog: kind => electron.ipcRenderer.invoke("application-log-open", kind),
        tun: createTunClient({ tun: nativeAdmin.tun, getTapInfo: () => cache.get(preferenceKeys.TAP_INFO) }),
        staticRoot,
        store,
        utilities,
        uuid: { v4: uuid },
        yaml
    };
}

module.exports = { createRendererRuntime };
