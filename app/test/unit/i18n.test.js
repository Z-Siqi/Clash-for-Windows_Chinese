"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { createTranslator, languageIndex, languageLocale, initialLanguageIndex, getSystemLanguage } = require("../../main/dist/electron/core/i18n/language");
const { createRendererLanguage } = require("../../main/dist/electron/entry/renderer/language-runtime");
const { createTrayState, registerTrayStateIpc } = require("../../main/dist/electron/features/tray/tray-state");

test("unselected language follows the primary OS UI language with English as the unsupported fallback", () => {
    for (const locale of ["zh", "zh-CN", "zh-TW", "zh-Hans-CN", "ZH_hant_TW"]) {
        assert.equal(initialLanguageIndex(null, locale), 0);
    }
    for (const locale of ["en", "en-US", "en-GB", "ja-JP", "fr-FR", "de", "", undefined]) {
        assert.equal(initialLanguageIndex(null, locale), 1);
    }
    assert.equal(initialLanguageIndex(0, "en-US"), 0);
    assert.equal(initialLanguageIndex(1, "zh-CN"), 1);
});

test("native language selection uses the first preferred UI language rather than the regional locale", () => {
    assert.equal(getSystemLanguage({ getPreferredSystemLanguages: () => ["en-GB", "zh-CN"], getLocale: () => "zh-CN" }), "en-GB");
    assert.equal(getSystemLanguage({ getPreferredSystemLanguages: () => ["fr-FR", "zh-CN"], getLocale: () => "zh-CN" }), "fr-FR");
    assert.equal(initialLanguageIndex(null, getSystemLanguage({ getPreferredSystemLanguages: () => ["fr-FR", "zh-CN"] })), 1);
    assert.equal(getSystemLanguage({ getPreferredSystemLanguages: () => [], getLocale: () => "zh-CN" }), "zh-CN");
    assert.equal(getSystemLanguage({}), "en");
});

test("i18n preserves every original message and array in both packaged catalogs", () => {
    const hashes = {
        "zh-CN": "16d6071946c5b48f3d11d77cfd2cd8115e71f4fa4827b63d4b1c8ad061cfe1d6",
        "en-US": "197485eb13322bf35d48cbcba405828e21b5d420ae2ca24385e30e2c88b79170"
    };
    const chinese = require("../../main/dist/electron/core/i18n/locales/zh-CN.json");
    for (const [locale, hash] of Object.entries(hashes)) {
        const catalog = require(`../../main/dist/electron/core/i18n/locales/${locale}.json`);
        // These fingerprints were captured from the removed Language class before migration.
        assert.equal(createHash("sha256").update(JSON.stringify(catalog)).digest("hex"), hash);
        assert.deepEqual(Object.keys(catalog), Object.keys(chinese));
        const labels = createTranslator(locale);
        for (const [key, value] of Object.entries(catalog)) {
            assert.deepEqual(labels.t(key), value, `${locale}/${key}`);
            assert.deepEqual(labels[key](), value, `page adapter ${locale}/${key}`);
        }
    }
});

test("i18n translates from the current selection without changing other translator instances", () => {
    let selected = 0;
    const labels = createTranslator(() => selected);
    const worker = createTranslator(0);
    assert.equal(labels.t("settings"), "设置");
    selected = 1;
    assert.equal(labels.t("settings"), "Settings");
    assert.equal(labels.locale(), "en-us");
    assert.equal(worker.t("settings"), "设置");
    selected = 0;
    assert.equal(labels.t("settings"), "设置");
    assert.equal(labels.t("missing.translation"), "missing.translation");
    assert.equal(labels.t("missing", { defaultValue: "Hello {{name}}", name: "<user>" }), "Hello <user>");
});

test("locale identifiers and old numeric preferences share the same selection policy", () => {
    for (const value of [undefined, null, 0, "0", "zh-CN", "zh-cn"]) {
        assert.equal(languageIndex(value), 0);
        assert.equal(languageLocale(value), "zh-CN");
    }
    for (const value of [1, "1", "en-US", "en-us", -1]) {
        assert.equal(languageIndex(value), 1);
        assert.equal(languageLocale(value), "en-US");
    }
});

test("language selection persists the numeric preference and updates tray IPC without a reload", async () => {
    const saved = [], calls = [], modifyState = { language: 0 };
    const runtime = createRendererLanguage({ modifyState, cache: { put: (...args) => saved.push(args) },
        ipcRenderer: { invoke: async (...args) => calls.push(args) } });
    const labels = runtime.getLanguage();
    await runtime.setLanguageIndex("en-US");
    assert.equal(runtime.getLanguage(), labels);
    assert.equal(labels.t("general"), "General");
    assert.deepEqual(saved, [["language", 1]]);
    assert.deepEqual(calls, [["cfw-language", 1]]);
    await runtime.setLanguageIndex(1);
    assert.equal(calls.length, 1);
    await runtime.setLanguageIndex(0);
    assert.equal(labels.t("general"), "主页");
    assert.deepEqual(calls.at(-1), ["cfw-language", 0]);
});

test("a failed preference write leaves the active language and tray unchanged", () => {
    const modifyState = { language: 0 };
    const runtime = createRendererLanguage({ modifyState, cache: { put() { throw Error("write failed"); } },
        ipcRenderer: { invoke() { assert.fail("tray must not change"); } } });
    assert.throws(() => runtime.setLanguageIndex(1), /write failed/);
    assert.equal(runtime.getLanguage().t("settings"), "设置");
});

test("language IPC refreshes the native Linux tray after changing its selection", () => {
    const handlers = new Map(), refreshed = [], state = createTrayState();
    registerTrayStateIpc({
        ipcMain: { handle: (name, handler) => handlers.set(name, handler), on() {} }, state,
        isLinux: () => true, getLocalizedMenu() {}, showMainWindow() {},
        refreshMenu: () => refreshed.push(state.language)
    });
    handlers.get("cfw-language")(null, 1);
    handlers.get("cfw-language")(null, 0);
    assert.deepEqual(refreshed, [1, 0]);
});
