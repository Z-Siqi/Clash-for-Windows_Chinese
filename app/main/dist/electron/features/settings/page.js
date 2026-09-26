"use strict";

const { createSettingsPageComponents } = require("./page-components");
const { createSettingsPageOptions } = require("./page-options");
const { createSettingsPageRender } = require("./page-render");

function createSettingsPage({
    defineComponent,
    cache,
    keys,
    yaml,
    fs,
    Vuex,
    SimpleInput,
    SelectView,
    SwitchView,
    draggable,
    Navigator,
    Hint,
    defaultBypass,
    defaultPac,
    getNetworkInterfaces,
    electron,
    path,
    childProcess,
    uuid,
    isMacOS,
    isWindows,
    logger,
    showMessageBox,
    updateYaml,
    Info,
    getWlanInterfaces,
    getLanguage,
    setLanguageIndex,
    languageKey,
    renderConnectionDisconnectSettings
}) {
    const localComponents = createSettingsPageComponents({ defineComponent, Vuex, draggable, getLanguage });
    const options = createSettingsPageOptions({
        Vuex,
        components: {
            ...localComponents,
            SimpleInput,
            SelectView,
            SwitchView,
            Navigator,
            Hint,
            Info
        },
        yaml,
        fs,
        defaultBypass,
        defaultPac,
        getNetworkInterfaces,
        electron,
        path,
        childProcess,
        uuid,
        isMacOS,
        isWindows,
        logger,
        showMessageBox,
        updateYaml,
        getWlanInterfaces,
        getLanguage
    });
    const render = createSettingsPageRender({
        getLanguage,
        cache,
        keys,
        setLanguageIndex,
        languageKey,
        renderConnectionDisconnectSettings
    });
    return defineComponent(options, render, "fc0cd1de");
}

module.exports = { createSettingsPage };
