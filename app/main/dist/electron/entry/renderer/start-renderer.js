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

const VERSION = "Opt-4";

function startRenderer({
    windowObject = window,
    documentObject = document,
    staticRoot = globalThis.__static
} = {}) {
    const modifyState = {
        languageInProfile: -1,
        language: -1,
        isTun: false,
        isMixin: false,
        adImages: ""
    };
    const runtime = createRendererRuntime({
        Vue, Vuex, Language, modifyState, windowObject, staticRoot
    });
    const components = createSharedComponents({
        Language, modifyState, windowObject, documentObject,
        electron: runtime.electron,
        platform: runtime.platform,
        utilities: runtime.utilities,
        preferenceKeys: runtime.keys,
        cache: runtime.cache,
        store: runtime.store,
        axios: runtime.axios,
        fs: runtime.fs,
        path: runtime.path
    });
    const pages = createRendererPages({
        Vuex, Language, modifyState, runtime, components, version: VERSION
    });
    const router = createRendererRouter({ Vue, Router, pages });
    const capabilities = createRendererCapabilities({
        platform: process.platform,
        ipcRenderer: runtime.electron.ipcRenderer,
        fs: runtime.fs,
        path: runtime.path,
        childProcess: runtime.childProcess,
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
        electronPlugin: process.env.IS_WEB ? null : electronPlugin,
        platform: process.platform,
        ipcRenderer: runtime.electron.ipcRenderer,
        fs: runtime.fs,
        path: runtime.path,
        yaml: runtime.yaml,
        cloneDeep: runtime.lodash.cloneDeep,
        modifyState
    });
}

module.exports = { VERSION, startRenderer };
