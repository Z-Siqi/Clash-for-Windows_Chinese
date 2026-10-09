"use strict";

const i18next = require("i18next");
const resources = {
    "zh-CN": { translation: require("./locales/zh-CN.json") },
    "en-US": { translation: require("./locales/en-US.json") }
};

const i18n = i18next.createInstance();
// Packaged resources are available synchronously, including in utility workers.
i18n.init({
    resources, lng: "zh-CN", fallbackLng: "en-US", supportedLngs: Object.keys(resources),
    initAsync: false, returnObjects: true, keySeparator: false,
    // Vue text nodes and native dialogs handle escaping at their presentation boundary.
    interpolation: { escapeValue: false }
});

function languageIndex(value) {
    return value == null || value === 0 || value === "0" || /^zh(?:-|$)/i.test(String(value)) ? 0 : 1;
}

function languageLocale(value) {
    return languageIndex(value) === 0 ? "zh-CN" : "en-US";
}

function initialLanguageIndex(savedLanguage, systemLanguage) {
    if (savedLanguage != null) return languageIndex(savedLanguage);
    // The first OS UI language wins; unsupported languages fall back to English.
    return /^zh(?:[-_]|$)/i.test(String(systemLanguage || "").trim()) ? 0 : 1;
}

function getSystemLanguage(app) {
    return app.getPreferredSystemLanguages?.()?.[0] || app.getLocale?.() || "en";
}

function createTranslator(selectedLanguage = 0) {
    const locale = () => languageLocale(typeof selectedLanguage === "function" ? selectedLanguage() : selectedLanguage);
    const labels = {
        t: (key, options) => i18n.t(key, { ...options, lng: locale() }),
        locale: () => locale().toLowerCase()
    };
    // Existing unpacked pages keep their semantic method API; all messages have one i18n owner.
    for (const key of Object.keys(resources["en-US"].translation)) {
        labels[key] = options => labels.t(key, options);
    }
    return labels;
}

module.exports = { createTranslator, languageIndex, languageLocale, initialLanguageIndex, getSystemLanguage };
