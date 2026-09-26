"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Vuex = require("../../main/node_modules/vuex");
const axios = require("../../main/node_modules/axios");
const { Language } = require("../../main/dist/electron/core/i18n/language");
const { createFeedbackPage } = require("../../main/dist/electron/features/feedback/page");
const { createSharedComponents } = require("../../main/dist/electron/entry/renderer/create-shared-components");

function rendererComponents({ locale = 0, monaco, overrides = {}, bindings = {} } = {}) {
    const runtimeMonaco = monaco || {
        Selection: class {}, KeyMod: {}, KeyCode: {},
        editor: { create() {}, registerCommand() {} },
        languages: {
            CompletionItemKind: {}, CompletionItemInsertTextRule: {},
            registerCompletionItemProvider() {}, registerCodeLensProvider() {}
        }
    };
    runtimeMonaco.languages.CompletionItemKind ||= {};
    runtimeMonaco.languages.CompletionItemInsertTextRule ||= {};
    runtimeMonaco.languages.registerCodeLensProvider ||= () => {};
    runtimeMonaco.editor.registerCommand ||= () => {};
    const modifyState = { language: locale };
    const windowObject = { __CFW_MONACO__: runtimeMonaco, ...bindings.window };
    const documentObject = bindings.document || {};
    const cache = overrides.cache || { get: () => null, put() {} };
    const preferenceKeys = overrides.preferenceKeys || {};
    const electron = {
        ipcRenderer: { invoke: async () => ({ response: 0 }) },
        shell: { openExternal() {}, showItemInFolder() {} },
        clipboard: { writeText() {} },
        ...overrides.electron
    };
    const readableUtilities = {
        hashText: value => value,
        showMessageBox: async () => ({ response: 0 }),
        confirmOpenExternal() {},
        ...overrides.utilities
    };
    const editorLanguagesOverride = overrides.editorLanguages;
    const store = { state: { app: { clashPath: "" } } };
    const shared = createSharedComponents({
        Language, modifyState, windowObject, documentObject, electron,
        platform: { isMacOS: () => false }, utilities: readableUtilities,
        preferenceKeys, cache, store,
        axios: overrides.axios || axios, fs, path, editorLanguagesOverride
    });
    const feedbackPage = createFeedbackPage({
        defineComponent: require("../../main/dist/electron/features/renderer-ui/component").defineComponent,
        escCaptureComponent: shared.EscCapture, Language, modifyState, cache,
        keys: preferenceKeys, httpClient: overrides.axios || axios, shell: electron.shell
    });
    return {
        "simple-input": shared.SimpleInput,
        "esc-capture": shared.EscCapture,
        hint: shared.Hint,
        "info-icon": shared.InfoIcon,
        navigator: shared.Navigator,
        "select-view": shared.SelectView,
        toggle: shared.SwitchView,
        alert: shared.dialogs.alert,
        "code-editor": shared.dialogs.code,
        "diff-editor": shared.dialogs.diff,
        dns: shared.dialogs.dns,
        input: shared.dialogs.input,
        menu: shared.dialogs.menu,
        "script-editor": shared.dialogs.script,
        select: shared.dialogs.select,
        toast: shared.dialogs.toast,
        "feedback-page": feedbackPage
    };
}

module.exports = { rendererComponents };
