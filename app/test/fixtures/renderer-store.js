"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Vue = require("../../main/node_modules/vue");
const Vuex = require("../../main/node_modules/vuex");
const yaml = require("../../main/node_modules/yaml");
const lodash = require("../../main/node_modules/lodash");
const { Language } = require("../../main/dist/electron/core/i18n/language");
const { createJsonCache } = require("../../main/dist/electron/core/storage/json-cache");
const { connectionStatus, proxyStatus } = require("../../main/dist/electron/features/application-state/status");
const { preferenceKeys } = require("../../main/dist/electron/features/settings/preference-keys");
const {
    createRendererAppModule,
    createRendererStore
} = require("../../main/dist/electron/entry/renderer/create-renderer-store");

function buildStore({ home, storage = new Map(), fileSystem = fs, axios = { create: () => null } }) {
    const cache = createJsonCache({
        getItem: key => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, value)
    });
    const ipcCalls = [];
    const modifyState = { language: -1 };
    const app = createRendererAppModule({
        fs: fileSystem, path, yaml, axios,
        got: { extend: () => ({}) },
        WebSocket: class {},
        trim: lodash.trim,
        platform: process.platform,
        arch: process.arch,
        cache,
        keys: preferenceKeys,
        connectionStatus,
        proxyStatus,
        ipcRenderer: { invoke: async (...args) => { ipcCalls.push(args); return home; } },
        modifyState,
        labels: new Language(cache.get("language"))
    });
    const store = createRendererStore({ Vue, Vuex, modules: { app } });
    store.commit("SET_CLASH_PATH", { path: home });
    store.commit("SET_PROFILES_PATH", { path: home });
    return {
        store, cache, keys: preferenceKeys, storage,
        connectionStatus, proxyStatus, modifyState, ipcCalls
    };
}

module.exports = { buildStore };
