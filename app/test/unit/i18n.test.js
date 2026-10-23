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

test("i18n preserves migrated catalogs apart from reviewed additions and copy updates", () => {
    const hashes = {
        "zh-CN": "16d6071946c5b48f3d11d77cfd2cd8115e71f4fa4827b63d4b1c8ad061cfe1d6",
        "en-US": "197485eb13322bf35d48cbcba405828e21b5d420ae2ca24385e30e2c88b79170"
    };
    const chinese = require("../../main/dist/electron/core/i18n/locales/zh-CN.json");
    const renamedChineseMessages = {
        TAPdeviceManagement: "虚拟网卡设置管理",
        mixin: "混合配置",
        mixinAllowsDescribe: "Mixin允许您覆盖原始配置文件",
        customizeTrayIconInProxyDescribe: "设置当 系统代理/TUN/混合配置 开启时的任务栏图标",
        titleBarTextDescribeFifth: "Mixin 状态，开或关",
        breakWhenModeChangeDescribe: "在 Rule（规则）、Global（全局）、Direct（直连）或 Script（脚本）之间切换时，断开所有核心连接。此处不指 System Proxy、TUN 或 Mixin 开关。",
        breakWhenProxyDisabledDescribe: "成功关闭 System Proxy，或关闭 TUN/Mixin 并实际停用 TUN/TAP 后，断开操作前已存在的核心连接。开启代理或普通配置刷新不会触发此选项，操作后新建的连接会保留。默认开启。",
        interfaceNameDescribe: "像 Mixin 一样设置接口名覆盖，以后会移除",
        editMixinContent: "编辑 Mixin 内容"
    };
    const clarifiedEnglishMessages = { mixinAllowsDescribe: "Mixin allows you to overwrite the original configuration file" };
    const additionalMessages = new Set([
        "updateCheckFailed",
        "mixedPortChangeFailed", "mixedPortSaveFailed", "mixedPortRollbackFailed",
        "autoRedirectConfirm", "autoRedirectConfirmationPending", "autoRedirectRequiresRoute",
        "dhcpIdentityReselect",
        "autoRedirectNeedsAutoRoute",
        "dhcpPolicyLimit",
        "tapAllowMulticast", "tapAllowMulticastDescribe",
        "connectionsProcessingFailed",
        "tapNoPreviousConfiguration", "tapRollbackFailed", "profileDeleteWithReferences",
        "anyTlsRequiresMihomo", "ipv4Required", "copiedToClipboard",
        "profileDeleteReferences", "profileReplaceAndDelete", "profileDeleteKeepReferences", "profileReplacementTarget", "profileUnresolvedReferences", "profileReferenceCycle", "profileDuplicateName",
        "pacServerPort", "pacInvalidLegacyPort", "pacUseRandom", "pacSetFixed", "pacPortRestart", "pacCurrentPort", "pacPortOccupied", "pacPortDenied", "pacStartFailed",
        "invalidWebSocketHeaders",
        "profileSwitching",
        "trustedCertificateOrigins", "trustedCertificateOriginsDescribe", "profileDownloadExceptions", "profileDownloadExceptionsDescribe",
        "allowRemoteProfileParsers", "allowRemoteProfileParsersDescribe", "confirmRemoteProfileParsers", "invalidSecuritySetting",
        "allowHttpExternalLinks", "allowHttpExternalLinksDescribe", "confirmHttpExternalLinks", "profileProcessingTimedOut",
        "serviceApplying", "serviceRestarting", "legacyTap", "legacyTapDescribe", "networkAppliedState", "networkEnabled", "networkDisabled",
        "networkTunOverridden", "networkTunFromProfile", "networkTunOptionsOverridden", "networkDnsOverridden", "networkTunDnsDisabled",
        "networkLegacyTapActive", "networkBypassHint", "networkDnsListen53", "breakWhenProxyDisabledScopedDescribe",
        "networkConfiguration", "previewSubmittedConfiguration", "networkStateUnavailable", "networkApplying",
        "resetDNSSettingsHint", "resetDNSSettingsDescribe", "detectedServers", "serviceAlreadyInstalled",
        "later", "note", "maxMindLicenseKey", "fakeIPCacheCleared",
        "fakeIPCacheClearFailed", "md5Copied", "scriptTestResult", "pleaseWait",
        "requiredFieldMissing", "diffTitle", "externalEditorLaunching", "dhcpServiceUnavailable",
        "trustCertificate", "certificateErrorTitle", "certificateErrorMessage", "certificateTrustMessage",
        "dashboardCrashed", "reloadDashboard", "exitApplication", "selectProviderFile",
        "editProxyGroupTitle", "newProxyGroupTitle", "editProxyTitle", "newProxyTitle",
        "proxyGroupName", "intervalSeconds", "clientFingerprintPlaceholder", "alpnPlaceholder",
        "idleSessionCheckInterval", "idleSessionTimeout", "minimumIdleSessions", "password",
        "obfsPlaceholder", "obfsHostPlaceholder", "optionalUsername", "optionalPassword",
        "webSocketPath", "webSocketHeaders",
        "dnsAnswer", "dnsAdditional", "dhcpIPRange", "rangeFrom", "rangeTo", "primaryDNS", "alternativeDNS", "continueAction",
        "profileNotMapping", "mixinNotMapping", "selectedProfileMissing", "profileSwitchStatus", "profileApplyError", "profileErrorLocation", "profileInvalidYaml",
        "tapAdapter", "tapPermission", "tapPermissionDescribe", "tapMixinOnly", "tapDisable", "tapStatusUnknown", "tapNotInstalled", "tapDisabled", "tapRestricted", "tapEnabled", "tapEnabledDescribe", "tapMixinDescribe", "tapDisabledDescribe", "tapAuthorizationExample", "tapYamlAuthorization", "tapJsAuthorization"
    ]);
    for (const [locale, hash] of Object.entries(hashes)) {
        const catalog = require(`../../main/dist/electron/core/i18n/locales/${locale}.json`);
        // Preserve migration fingerprints across the reviewed Mixin naming update.
        const original = Object.fromEntries(Object.entries(catalog).filter(([key]) => !additionalMessages.has(key))
            .map(([key, value]) => [key, (locale === "zh-CN" ? renamedChineseMessages : clarifiedEnglishMessages)[key] ?? value]));
        assert.equal(createHash("sha256").update(JSON.stringify(original)).digest("hex"), hash);
        for (const key of additionalMessages) {
            assert.ok(typeof catalog[key] === "string" && catalog[key].length > 0);
            const placeholders = message => [...message.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort();
            assert.deepEqual(placeholders(catalog[key]), placeholders(chinese[key]), `${locale}/${key} interpolation`);
        }
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
