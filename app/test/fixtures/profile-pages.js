"use strict";

const { rendererLanguage } = require("./renderer-harness");
const { createServerPageWorkflow } = require("../../main/dist/electron/features/profiles/server-page-workflow");
const { createProxiesPage } = require("../../main/dist/electron/features/proxies/page");
const { defineComponent } = require("../../main/dist/electron/features/renderer-ui/component");
const Vuex = require("../../main/node_modules/vuex");
const lodash = require("../../main/node_modules/lodash");

const EmptyComponent = { render: h => h("span") };

function profilePage({ store, parent, dialogs, locale = 1, downloadProfile = async () => ({}) }) {
    const labels = (rendererLanguage())(locale);
    const { methods } = createServerPageWorkflow({
        labels,
        getLanguage: () => labels,
        moment: () => ({ locale() { return this; }, from() { return ""; } }),
        yaml: { parse: () => ({}) },
        fs: {}, path: {}, electron: {}, lodash: {}, CancelToken: class {},
        downloadProfile, runUserScript() {}, profileScriptType: "profile",
        scheduler: {}, confirmOpenExternal() {}, cloneJson: value => value,
        showMessageBox: async options => { dialogs.push(options); return { response: 0 }; },
        formatBytes: String
    });
    return {
        ...methods, loadingProfileIndex: [], downlodingUrls: {}, $parent: parent,
        $delete: (object, key) => { delete object[key]; },
        get pfs() { return store.state.app.profiles; },
        get settings() { return store.state.app.settings; },
        get clashApi() { return store.getters.clashApi; },
        changeProfilesIndex: payload => store.commit("CHANGE_PROFILES_INDEX", payload),
        openProfile() { throw new Error("Unexpected editor opening"); }
    };
}

function proxiesPage(store, locale = 1, reactive = false) {
    const labels = (rendererLanguage())(locale);
    const page = createProxiesPage({
        defineComponent,
        slicedToArray: require("../../main/node_modules/@babel/runtime/helpers/slicedToArray"),
        asyncToGenerator: require("../../main/node_modules/@babel/runtime/helpers/asyncToGenerator"),
        toConsumableArray: require("../../main/node_modules/@babel/runtime/helpers/toConsumableArray"),
        defineProperty: require("../../main/node_modules/@babel/runtime/helpers/defineProperty"),
        regenerator: require("../../main/node_modules/@babel/runtime/regenerator"),
        Hint: EmptyComponent, Navigator: EmptyComponent, Vuex, axios: {},
        cache: { get: () => null, put() {} }, keys: {}, lodash,
        scripts: { TX: async value => value, ay: "proxy" },
        utilities: { EP: value => JSON.parse(JSON.stringify(value)) },
        status: { CONNECTED: "connected" }, velocity() {},
        scheduler: { ZP: { add: () => "timer", stop() {} } }, getLanguage: () => labels
    });
    if (reactive) {
        const Vue = require("../../main/node_modules/vue");
        return new (Vue.extend({ mixins: [page], computed: {
            clashApi: () => store.getters.clashApi, settings: () => store.state.app.settings
        } }))({ store });
    }
    return {
        ...page.methods, proxies: [], testingProxyNames: [], delayKeyName: "delay",
        get clashApi() { return store.getters.clashApi; },
        get settings() { return store.state.app.settings; },
        get currentMode() { return store.state.app.mode; },
        get proxyInMode() { return page.computed.proxyInMode.call(this); }
    };
}

module.exports = { profilePage, proxiesPage };
