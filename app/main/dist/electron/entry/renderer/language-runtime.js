"use strict";

const { createTranslator, languageIndex } = require("../../core/i18n/language");

function createRendererLanguage({ modifyState, cache, ipcRenderer, languageKey = "language" }) {
    const labels = createTranslator(() => modifyState.language);
    return {
        getLanguage: () => labels,
        setLanguageIndex(value) {
            const index = languageIndex(value);
            // Save first so a failed preference write cannot leave a half-applied selection.
            cache.put(languageKey, index);
            if (modifyState.language === index) return Promise.resolve();
            modifyState.language = index;
            return ipcRenderer.invoke("cfw-language", index);
        }
    };
}

module.exports = { createRendererLanguage };
