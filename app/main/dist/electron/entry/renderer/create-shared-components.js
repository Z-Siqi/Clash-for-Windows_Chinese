"use strict";

const lodash = require("lodash");
const yaml = require("yaml");
const Vuex = require("vuex");

const { createAlert } = require("../../features/renderer-ui/components/alert");
const { createCodeEditor } = require("../../features/renderer-ui/components/code-editor");
const { createDiffEditor } = require("../../features/renderer-ui/components/diff-editor");
const { createDns } = require("../../features/renderer-ui/components/dns");
const { createEscCapture } = require("../../features/renderer-ui/components/esc-capture");
const { createHint } = require("../../features/renderer-ui/components/hint");
const { createInfoIcon } = require("../../features/renderer-ui/components/info-icon");
const { createInput } = require("../../features/renderer-ui/components/input");
const { createMenu } = require("../../features/renderer-ui/components/menu");
const { createNavigator } = require("../../features/renderer-ui/components/navigator");
const { createScriptEditor } = require("../../features/renderer-ui/components/script-editor");
const { createSelect } = require("../../features/renderer-ui/components/select");
const { createSelectView } = require("../../features/renderer-ui/components/select-view");
const { createSimpleInput } = require("../../features/renderer-ui/components/simple-input");
const { createToast } = require("../../features/renderer-ui/components/toast");
const { createToggle } = require("../../features/renderer-ui/components/toggle");
const { installEditorLanguage } = require("../../features/renderer-ui/editor-language");
const { getMonacoRuntime } = require("./monaco-runtime");

function createSharedComponents({
    Language,
    modifyState,
    windowObject,
    documentObject,
    electron,
    platform,
    utilities,
    preferenceKeys,
    cache,
    store,
    axios,
    fs,
    path,
    editorLanguagesOverride
}) {
    const common = {
        Vuex,
        Language,
        modifyState,
        window: windowObject,
        document: documentObject
    };
    const EscCapture = createEscCapture(common);
    const Hint = createHint(common);
    const SelectView = createSelectView(common);
    const Navigator = createNavigator({ ...common, lodash });
    const SimpleInput = createSimpleInput({ ...common, lodash });
    const SwitchView = createToggle(common);
    const InfoIcon = createInfoIcon({ ...common, utilities });
    const monaco = getMonacoRuntime(windowObject);
    const editorLanguages = editorLanguagesOverride || installEditorLanguage({
        monaco,
        axios,
        fs,
        path,
        store,
        hashText: utilities.hashText,
        showMessageBox: utilities.showMessageBox,
        shell: electron.shell,
        clipboard: electron.clipboard,
        labels: new Language(modifyState.language)
    });
    const editorCommon = {
        monaco,
        platform,
        utilities,
        escCaptureComponent: EscCapture,
        hintComponent: Hint,
        preferenceKeys,
        cache,
        electron,
        Language,
        modifyState,
        window: windowObject,
        document: documentObject
    };

    const dialogs = {
        alert: createAlert({ ...common, escCaptureComponent: EscCapture }),
        code: createCodeEditor({
            ...editorCommon,
            yaml,
            Vuex,
            navigatorComponent: Navigator,
            editorLanguages
        }),
        diff: createDiffEditor({
            ...editorCommon,
            preferenceKeys
        }),
        dns: createDns({
            ...common,
            escCaptureComponent: EscCapture
        }),
        input: createInput({ ...common, escCaptureComponent: EscCapture }),
        menu: createMenu({ ...common, escCaptureComponent: EscCapture }),
        script: createScriptEditor({
            ...editorCommon,
            Vuex,
            selectViewComponent: SelectView
        }),
        select: createSelect({
            ...common,
            escCaptureComponent: EscCapture,
            selectViewComponent: SelectView,
            utilities
        }),
        toast: createToast(common)
    };

    return {
        dialogs,
        editorLanguages,
        EscCapture,
        Hint,
        InfoIcon,
        Navigator,
        SelectView,
        SimpleInput,
        SwitchView
    };
}

module.exports = { createSharedComponents };
