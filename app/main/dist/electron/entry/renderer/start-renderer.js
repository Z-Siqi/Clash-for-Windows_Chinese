"use strict";

const Vue = require("vue/dist/vue.runtime.common.prod.js");
const Vuex = require("vuex");
const Router = require("vue-router");
const electronPlugin = require("vue-electron");

const { Language } = require("../../core/i18n/language");
const { proxyStatus } = require("../../features/application-state/status");
const { createRendererRouter } = require("../../features/renderer-ui/router");
const { createRendererCapabilities } = require("./capabilities");
const { createRendererPages } = require("./create-pages");
const { createRendererRuntime } = require("./create-renderer-runtime");
const { createSharedComponents } = require("./create-shared-components");
const { mountRendererApplication } = require("./mount-application");

const { displayVersion } = require("../../core/release/release-info");

function startRenderer({
    windowObject = window,
    documentObject = document,
    staticRoot = globalThis.__static,
    processObject = process,
    electronHost
} = {}) {
    const modifyState = {
        languageInProfile: -1,
        language: -1,
        isTun: false,
        isMixin: false,
        adImages: ""
    };
    const runtime = createRendererRuntime({
        Vue, Vuex, Language, modifyState, windowObject, staticRoot, processObject, electronHost
    });
    const components = createSharedComponents({
        Language, modifyState, windowObject, documentObject,
        electron: runtime.electron,
        platform: runtime.platform,
        utilities: runtime.utilities,
        preferenceKeys: runtime.keys,
        cache: runtime.cache,
        store: runtime.store,
        publicContent: runtime.publicContent,
        providerFiles: runtime.providerFiles
    });
    const pages = createRendererPages({
        Vuex, Language, modifyState, runtime, components, version: displayVersion()
    });
    const router = createRendererRouter({ Vue, Router, pages });
    const capabilities = createRendererCapabilities({
        platform: processObject.platform,
        ipcRenderer: runtime.electron.ipcRenderer,
        fs: runtime.fs,
        path: runtime.path,
        childProcess: runtime.childProcess,
        systemProxy: runtime.systemProxy,
        runMacCommand: runtime.runMacSystemProxyCommand,
        parseBypass: runtime.yaml.parse,
        defaultBypass: runtime.defaultBypass,
        logger: runtime.logger,
        status: proxyStatus,
        modifyState,
        staticRoot
    });

    return mountRendererApplication({
        Vue, Vuex, store: runtime.store, router, document: documentObject,
        dialogs: components.dialogs, plugins: [capabilities],
        electronPlugin: processObject.env?.IS_WEB ? null : electronPlugin,
        platform: processObject.platform,
        ipcRenderer: runtime.electron.ipcRenderer,
        fs: runtime.fs,
        path: runtime.path,
        yaml: runtime.yaml,
        settingsRepository: runtime.settingsRepository,
        cloneDeep: runtime.lodash.cloneDeep,
        modifyState
    });
}

module.exports = { VERSION: displayVersion(), startRenderer };
