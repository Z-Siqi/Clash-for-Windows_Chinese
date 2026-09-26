"use strict";

const { createHomePageComponents } = require("./page-components");
const { createHomePageOptions } = require("./page-options");
const { renderHomePage } = require("./page-render");

function createHomePage(dependencies) {
    const localComponents = createHomePageComponents({
        defineComponent: dependencies.defineComponent,
        Vuex: dependencies.Vuex,
        lodash: dependencies.lodash,
        draggable: dependencies.draggable,
        cache: dependencies.cache,
        keys: dependencies.keys,
        connectedStatus: dependencies.connectionStatus.CONNECTED,
        electron: dependencies.electron,
        path: dependencies.path,
        fs: dependencies.fs,
        requireFromString: dependencies.requireFromString,
        scheduler: dependencies.scheduler,
        Hint: dependencies.Hint,
        getLanguage: dependencies.getLanguage
    });
    const options = createHomePageOptions({
        ...dependencies,
        components: {
            MainMenu: localComponents.MainMenu,
            StatusBar: localComponents.StatusBar
        }
    });
    return dependencies.defineComponent(options, renderHomePage, "68cbbc92");
}

module.exports = { createHomePage };
