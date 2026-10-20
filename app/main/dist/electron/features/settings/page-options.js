"use strict";

const { supportsScriptMode } = require("../../core/clash-core/core-capabilities");
const { readDownloadExceptions } = require("../../core/network/profile-download-policy");
const { normalizeCertificateExceptions } = require("../../core/network/certificate-exceptions");
const { guardSettingsMethods, isProxySetting } = require("./proxy-operation-guards");

const SECTION_KEYS = [
    "security", "general", "appearance", "sysProxy", "mixin", "proxies", "connections",
    "providers", "outbound", "childProcesses", "profiles", "logs", "ssid", "actions",
    "shortcut", "settingsEditor", "cache", "experimentalFeatures"
];

function createSettingsPageOptions({
    Vuex,
    components,
    yaml,
    defaultBypass,
    defaultPac,
    getNetworkInterfaces,
    electron,
    path,
    externalEditor,
    openApplicationLog,
    uuid,
    isMacOS,
    isWindows,
    showMessageBox,
    updateYaml,
    getWlanInterfaces,
    getLanguage
}) {

    return {
        components,
        data() {
            return {
                scrollTop: 0,
                fontFamilyPlaceholder: isMacOS() ? "PingFang SC" : isWindows() ? "Microsoft Yahei" : "system-ui",
                isEditingExternal: false
            };
        },
        computed: {
            proxyBusy() { return !!this.$parent?.proxyBusy; },
            sections() {
                const labels = getLanguage();
                // The experimental section currently renders only macOS DHCP controls.
                const keys = this.isMacOS ? SECTION_KEYS : SECTION_KEYS.filter(key => key !== "experimentalFeatures");
                return keys.map(key => labels[key]());
            },
            ...Vuex.mapState({
                detectedInterfaceName: state => state.app.detectedInterfaceName,
                clashPath: state => state.app.clashPath,
                confData: state => state.app.confData,
                scriptModeVisible: state => supportsScriptMode(state.app.settings.proxyCore)
            }),
            ...Vuex.mapGetters(["clashAxiosClient", "secret"])
        },
        watch: {
            "sts.profilePath"() { this.refreshCore(); }
        },
        methods: guardSettingsMethods({
            ...Vuex.mapMutations({
                saveSettingsObject: "SAVE_SETTINGS_OBJECT",
                setConfData: "SET_CONF_DATA"
            }),
            ...Vuex.mapActions(["getParserLogPath", "getScriptLogPath"]),
            async handleProxyCoreChange(index) {
                const nextCore = index === 1 ? "mihomo" : "clash";
                if (this.settings.proxyCore === nextCore) return;
                const change = async () => {
                    if (!supportsScriptMode(nextCore) && this.$parent.mode === "script") await this.$parent.switchMode("rule");
                    // This write belongs to the acquired core operation, bypassing
                    // only the UI settings guard; preserve all other current values.
                    this.saveSettingsObject({ obj: { ...this.settings, proxyCore: nextCore } });
                    electron.ipcRenderer.send("core-type-changed", nextCore);
                    await this.$parent.handlerRestartClash();
                    return true;
                };
                return this.$parent.runProxyOperation("core", change);
            },
            async refreshCore() {
                await this.$parent.handlerRestartClash();
            },
            handleNavigateToGroup(index) {
                const scrollContainer = this.$refs["mixin-scroll-content"];
                const section = scrollContainer.children[index];
                this.$nextTick(() => { scrollContainer.scrollTop = section.offsetTop - 110; });
            },
            cancelExternalEdit() {
                externalEditor.cancel();
            },
            async edit(settingName, fallback = "", language = "yaml", validate) {
                if (isProxySetting(settingName) && this.$parent?.proxyBusy) return false;
                let changed = false;
                try {
                    const currentValue = this.settings[settingName] || fallback;
                    const editor = this.settings.editor ?? 0;
                    if (editor === 0) {
                        try {
                            const { code = "" } = await this.$code({
                                code: currentValue,
                                language,
                                fontSize: this.settings.editorFontSize
                            });
                            if (validate) await validate(code);
                            if (isProxySetting(settingName) && this.$parent?.proxyBusy) return false;
                            this.settings[settingName] = code;
                            changed = code !== currentValue;
                        } catch (_error) {}
                    } else {
                        this.isEditingExternal = true;
                        const value = await externalEditor.edit(language, currentValue);
                        if (validate) await validate(value);
                        if (isProxySetting(settingName) && this.$parent?.proxyBusy) return false;
                        this.settings[settingName] = value;
                        changed = value !== currentValue;
                    }
                } catch (_error) {
                    // Closing an external editor or the internal modal cancels the edit.
                } finally {
                    this.isEditingExternal = false;
                }
                return changed;
            },
            async handleEditBypass() {
                await this.edit("bypassText", yaml.stringify({ bypass: defaultBypass }));
            },
            async handleEditPACContent() {
                await this.edit("pacContentText", defaultPac, "javascript");
            },
            async handleEditMixinYAML() {
                await this.edit("mixinText", "mixin: # object\n");
            },
            async handleEditMixinJS() {
                const template = "module.exports.parse = ({ content, name, url }, { yaml, axios, notify }) => {\n  return content\n}";
                await this.edit("mixinCode", template, "javascript");
            },
            async handleEditUnsafeURLs() {
                await this.edit("unsafeURLsText", "urls: # array\n");
            },
            async editSecuritySetting(name, template, validate) {
                return this.edit(name, template, "yaml", async code => {
                    try { validate(code); }
                    catch (error) {
                        await showMessageBox({ type: "error", message: getLanguage().invalidSecuritySetting(), detail: error.message });
                        throw error;
                    }
                });
            },
            async handleEditUnsafeOrigins() {
                return this.editSecuritySetting("unsafeURLOriginsText", "origins: []\n# origins:\n#   - https://trusted.example:8443\n", code => {
                    let document;
                    try { document = yaml.parse(code); } catch { throw new Error("Invalid origins YAML"); }
                    if (document == null) return;
                    const entries = document.origins ?? [];
                    if (!document || typeof document !== "object" || Array.isArray(document)
                        || Object.keys(document).some(key => key !== "origins") || !Array.isArray(entries)
                        || normalizeCertificateExceptions(entries, true).length !== entries.length) {
                        throw new Error("Use origins: [] with at most 128 exact HTTPS origins; paths, queries, credentials and wildcards are not allowed");
                    }
                });
            },
            async handleEditDownloadExceptions() {
                const template = "exceptions: []\n# exceptions:\n#   - url: https://trusted.example/profile.yaml\n#     maxSizeMiB: 64\n#     timeoutSeconds: 180\n#     processingTimeoutSeconds: 600\n";
                return this.editSecuritySetting("profileDownloadExceptionsText", template, text => readDownloadExceptions({ yaml, text }));
            },
            async handleRemoteProfileParsersChange(enabled) {
                if (enabled === (this.settings.allowRemoteProfileParsers === true)) return;
                if (enabled) {
                    const labels = getLanguage();
                    const result = await showMessageBox({ type: "warning", message: labels.confirmRemoteProfileParsers(),
                        buttons: [labels.no(), labels.yes()], defaultId: 0, cancelId: 0 });
                    if (result.response !== 1) return;
                }
                this.$set(this.settings, "allowRemoteProfileParsers", enabled === true);
            },
            async handleHttpExternalLinksChange(enabled) {
                if (enabled === (this.settings.allowHttpExternalLinks === true)) return;
                if (enabled) {
                    const labels = getLanguage();
                    const result = await showMessageBox({ type: "warning", message: labels.confirmHttpExternalLinks(),
                        buttons: [labels.no(), labels.yes()], defaultId: 0, cancelId: 0 });
                    if (result.response !== 1) return;
                }
                this.$set(this.settings, "allowHttpExternalLinks", enabled === true);
            },
            async handleEditHeaders() {
                await this.edit("headersText", "headers: # object\n");
            },
            async handleEditChildProcess() {
                if (await this.edit("childProcessText", "processes: # array\n")) await this.refreshCore();
            },
            async handleSelectInterface() {
                const labels = getLanguage();
                try {
                    const interfaces = (await getNetworkInterfaces()).map(networkInterface => networkInterface.name);
                    const [selectedIndex] = await this.$select({
                        title: labels.chooseOutboundInterface(),
                        message: labels.chooseOutboundInterfaceDescribe(),
                        items: [...interfaces, labels.reset()],
                        isLastDifferent: true
                    });
                    this.settings.interfaceName = selectedIndex === interfaces.length ? "" : interfaces[selectedIndex];
                } catch (_error) {}
            },
            async handleEditActionScripts() {
                await this.edit("scriptsText", yaml.stringify({ scripts: { proxy: {}, profile: {} } }));
            },
            async handleEditSSIDStrategy() {
                await this.edit("ssidStrategyText", "strategy: # object\n");
            },
            async handleFetchCurrentSSID() {
                const labels = getLanguage();
                const ssids = (await getWlanInterfaces()).map(networkInterface => networkInterface.SSID).filter(Boolean);
                const [selectedIndex] = await this.$select({
                    title: labels.currentSSID(),
                    message: labels.currentSSIDDescribe(),
                    items: [...ssids, labels.cancel()]
                });
                if (selectedIndex !== ssids.length) electron.clipboard.writeText(ssids[selectedIndex]);
            },
            async handleOpenActionScriptsConsoleFile() {
                await openApplicationLog("script");
            },
            async handleEditProfileParsers() {
                await this.edit("profileParsersText", "parsers: # array\n");
            },
            async handleOpenConsoleFile() {
                await openApplicationLog("parser");
            },
            async handleChooseDefaultIcon() {
                const selectedPath = await this.chooseFileOrPath();
                if (selectedPath) this.settings.iconDefault = selectedPath;
            },
            async handleChooseSystemProxytOnIcon() {
                const selectedPath = await this.chooseFileOrPath();
                if (selectedPath) this.settings.iconSystemProxy = selectedPath;
            },
            async handleChooseProfilePath() {
                const selectedPath = await this.chooseFileOrPath(false);
                if (selectedPath) this.settings.profilePath = selectedPath;
            },
            async handleSelectTrayScriptPath() {
                const selectedPath = await this.chooseFileOrPath();
                if (selectedPath) this.settings.trayScriptPath = selectedPath;
            },
            handleTrayScriptManualRun() {
                this.settings.trayScriptManualRunTime = Date.now();
            },
            async chooseFileOrPath(chooseFile = true) {
                const selectedPaths = await electron.ipcRenderer.invoke("dialog", "showOpenDialogSync", {
                    properties: [chooseFile ? "openFile" : "openDirectory"]
                });
                return selectedPaths?.[0];
            },
            async handleReset() {
                const labels = getLanguage();
                try {
                    await this.$alert({
                        title: labels.warning(),
                        content: labels.askResetAllSettings(),
                        isShowErrorBtn: true
                    });
                    if (this.$parent?.proxyBusy) return false;
                    this.saveSettingsObject({ obj: {} });
                    this.loadSettings();
                } catch (_error) {}
            },
            handleOpenGUILog() {
                return openApplicationLog("gui");
            },
            async handleOpenGUIDataFolder() {
                await electron.ipcRenderer.invoke("application-folder", "gui");
            },
            async handleQuit(cleanupDone = false) {
                const labels = getLanguage();
                const result = await showMessageBox({
                    type: "warning",
                    message: labels.askQuit(),
                    buttons: [labels.no(), labels.yes()]
                });
                if (result.response === 0) return;
                if (cleanupDone) electron.ipcRenderer.send("cleanup-done");
                else this.$parent.quit();
            },
            async handlerClearFakeIPCache() {
                const response = await this.clashApi.flushFakeIpCache({ validateStatus: () => true });
                const message = response.data?.message || "";
                await showMessageBox({
                    message: response.status === 204 ? "Fake IP cache cleared" : `Failed with reason: ${message}`
                });
            },
            async handleGenerateUUIDSecret() {
                const labels = getLanguage();
                const result = await showMessageBox({
                    type: "warning",
                    message: labels.askSetConfig(),
                    buttons: [labels.no(), labels.yes()]
                });
                if (result.response !== 1) return;
                if (this.$parent?.proxyBusy) return false;
                const save = async () => {
                    const secret = uuid.v4();
                    await updateYaml(path.join(this.clashPath, "config.yaml"), "secret", secret);
                    await this.reloadElectron();
                };
                return this.$parent?.runProxyOperation ? this.$parent.runProxyOperation("core", save) : save();
            }
        }),
        beforeRouteLeave(_route, _previousRoute, next) { next(); }
    };
}

module.exports = { createSettingsPageOptions };
