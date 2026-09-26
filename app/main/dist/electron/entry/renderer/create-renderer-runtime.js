"use strict";

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { Console } = require("console");
const axios = require("axios");
const BigNumber = require("bignumber.js");
const contentDisposition = require("content-disposition");
const logger = require("electron-log");
const getPort = require("get-port");
const got = require("got");
const { HttpsProxyAgent } = require("hpagent");
const Koa = require("koa");
const lodash = require("lodash");
const moment = require("moment");
const mousetrap = require("mousetrap");
const { merge: diff3Merge } = require("node-diff3");
const requireFromString = require("require-from-string");
const sudoPrompt = require("@vscode/sudo-prompt");
const cron = require("unix-cron");
const WebSocket = require("ws");
const yaml = require("yaml");

const { createPlatform } = require("../../core/runtime/platform");
const { createIntervalScheduler } = require("../../core/runtime/interval-scheduler");
const { createClipboardClient } = require("../../core/native/clipboard-client");
const { createNativeAdminClient } = require("../../core/native/native-admin-client");
const { createJsonCache } = require("../../core/storage/json-cache");
const { v4: uuid } = require("../../core/crypto/random-uuid");
const { createClashServiceApi } = require("../../core/network/clash-service-api");
const { createRendererAppModule, createRendererStore } = require("./create-renderer-store");
const { createRendererUtilities } = require("./utilities");
const { createUpdateRuntime } = require("../../features/application/update-runtime");
const { connectionStatus, proxyStatus } = require("../../features/application-state/status");
const { createMacSystemProxyCommand } = require("../../features/network/mac-system-proxy-command");
const { detectDefaultInterface, listNetworkInterfaces } = require("../../features/network/network-interfaces");
const { getDefaultBypass, defaultPac } = require("../../features/network/proxy-defaults");
const { listWlanInterfaces } = require("../../features/network/wlan-interfaces");
const { createProfileParser } = require("../../features/profiles/profile-parser");
const { PROFILE_SCRIPT, PROXY_SCRIPT, createUserScriptRunner } = require("../../features/scripts/user-script-runner");
const { createServiceModeManager } = require("../../features/service-mode/service-mode-manager");

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
    const cache = createJsonCache(windowObject.localStorage);
    const preferenceKeys = require("../../features/settings/preference-keys").preferenceKeys;
    const electron = Object.assign({}, electronHost, {
        clipboard: createClipboardClient(electronHost.ipcRenderer)
    });
    const appModule = createRendererAppModule({
        fs,
        path,
        yaml,
        axios,
        got,
        WebSocket,
        trim: lodash.trim,
        platform: processObject.platform,
        arch: processObject.arch,
        cache,
        keys: preferenceKeys,
        connectionStatus,
        proxyStatus,
        ipcRenderer: electron.ipcRenderer,
        modifyState,
        labels: new Language(cache.get("language"))
    });
    const store = createRendererStore({ Vue, Vuex, modules: { app: appModule } });
    const utilities = createRendererUtilities({
        fs,
        path,
        yaml,
        crypto,
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
    const serviceApi = createClashServiceApi({ client: axios });
    const serviceModule = createServiceModeManager({
        platform: processObject.platform,
        arch: processObject.arch,
        fs,
        path,
        sudoExec: sudoPrompt.exec,
        serviceApi,
        getFilesPath: () => store.getters.filesPath,
        getClashPath: () => store.state.app.clashPath,
        getTempPath: () => electron.ipcRenderer.invoke("app", "getPath", "temp"),
        hashFile: file => utilities.hashText(fs.readFileSync(file)),
        adminActions: nativeAdmin.service
    });
    const runMacSystemProxyCommand = createMacSystemProxyCommand({
        platform: processObject.platform,
        arch: processObject.arch,
        path,
        serviceApi,
        isDevelopmentMode: () => store.state.app.isDevMode,
        getFilesPath: () => store.getters.filesPath
    });
    const profileParser = createProfileParser({
        store,
        axios,
        got,
        fs,
        path,
        yaml,
        cloneDeep: lodash.cloneDeep,
        reduce: lodash.reduce,
        shuffle: lodash.shuffle,
        requireFromString,
        Console,
        notify: utilities.notify,
        diff3Merge,
        parseContentDisposition: contentDisposition.parse,
        HttpsProxyAgent,
        getLanguage: () => new Language(modifyState.language)
    });
    const userScriptRunner = createUserScriptRunner({
        store,
        axios,
        yaml,
        fs: require("original-fs"),
        Console,
        requireFromString,
        notify: utilities.notify,
        showMessageBox: utilities.showMessageBox,
        resolveHost: utilities.queryDns
    });
    const updateRuntime = createUpdateRuntime({
        isMacOS: platform.isMacOS(),
        path,
        ipcRenderer: electron.ipcRenderer,
        store,
        execSync: childProcess.execSync
    });
    const getNetworkInterfaces = () => listNetworkInterfaces({ networkInterfaces: os.networkInterfaces });
    const getDefaultInterface = () => detectDefaultInterface({
            platform: processObject.platform,
            execSync: childProcess.execSync,
            networkInterfaces: os.networkInterfaces,
            isIP: net.isIP,
            isIPv4: net.isIPv4
        });

    return {
        axios,
        cache,
        childProcess,
        cron,
        defaultBypass: getDefaultBypass(processObject.platform),
        defaultPac,
        downloadProfile: profileParser.downloadProfile,
        electron,
        firewall,
        fs,
        getPort,
        getDefaultInterface,
        getNetworkInterfaces,
        getWlanInterfaces: () => listWlanInterfaces({ platform: processObject.platform, execSync: childProcess.execSync }),
        Koa,
        keys: preferenceKeys,
        lodash,
        logger,
        moment,
        mousetrap,
        net,
        os,
        path,
        platform,
        profileParser,
        requireFromString,
        runMacSystemProxyCommand,
        scheduler,
        scripts: { profileScriptType: PROFILE_SCRIPT, proxyScriptType: PROXY_SCRIPT, run: userScriptRunner.run },
        serviceModule,
        staticRoot,
        store,
        sudoPrompt,
        updateApplication: updateRuntime.install,
        utilities,
        uuid: { v4: uuid },
        WebSocket,
        yaml
    };
}

module.exports = { createRendererRuntime };
