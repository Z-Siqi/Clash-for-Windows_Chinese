"use strict";

const { supportsScriptMode } = require("../../core/clash-core/core-capabilities");

function createExternalEditor({ electron, fs, path, childProcess }) {
    let rejectCurrentEdit = null;

    return {
        cancel() {
            if (rejectCurrentEdit) rejectCurrentEdit();
        },
        async edit(extension, content = "", command = "code --wait") {
            return new Promise((resolve, reject) => {
                rejectCurrentEdit = reject;
                electron.ipcRenderer.invoke("app", "getPath", "temp").then(tempDirectory => {
                    const target = path.join(tempDirectory, `close-to-save.${extension}`);
                    fs.writeFileSync(target, content);
                    childProcess.exec(`${command} ${target}`, { windowsHide: true }, error => {
                        if (error) reject(error);
                    }).on("exit", () => resolve(fs.readFileSync(target).toString()));
                }).catch(reject);
            });
        }
    };
}

function createSettingsPageOptions({
    Vuex,
    components,
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
}) {
    const externalEditor = createExternalEditor({ electron, fs, path, childProcess });

    return {
        components,
        data() {
            return {
                scrollTop: 0,
                fontFamilyPlaceholder: isMacOS() ? "PingFang SC" : isWindows() ? "Microsoft Yahei" : "system-ui",
                isEditingExternal: false,
                sections: []
            };
        },
        computed: {
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
        methods: {
            ...Vuex.mapMutations({
                saveSettingsObject: "SAVE_SETTINGS_OBJECT",
                setConfData: "SET_CONF_DATA"
            }),
            ...Vuex.mapActions(["getParserLogPath", "getScriptLogPath"]),
            async handleProxyCoreChange(index) {
                const nextCore = index === 1 ? "mihomo" : "clash";
                if (this.settings.proxyCore === nextCore) return;
                if (!supportsScriptMode(nextCore) && this.$parent.mode === "script") {
                    await this.$parent.switchMode("rule");
                }
                this.$set(this.settings, "proxyCore", nextCore);
                electron.ipcRenderer.send("core-type-changed", nextCore);
                return this.refreshCore();
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
            async edit(settingName, fallback = "", language = "yaml") {
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
                            this.settings[settingName] = code;
                            changed = code !== currentValue;
                        } catch (_error) {}
                    } else {
                        this.isEditingExternal = true;
                        const command = editor === 1 ? "code --wait" : this.settings.editorCustomCommand || "subl --wait";
                        const value = await externalEditor.edit(language, currentValue, command);
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
            async handleEditHeaders() {
                await this.edit("headersText", "headers: # object\n");
            },
            async handleEditChildProcess() {
                if (await this.edit("childProcessText", "processes: # array\n")) await this.refreshCore();
            },
            async handleSelectInterface() {
                const labels = getLanguage();
                try {
                    const interfaces = getNetworkInterfaces().map(networkInterface => networkInterface.name);
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
                const ssids = getWlanInterfaces().map(networkInterface => networkInterface.SSID).filter(Boolean);
                const [selectedIndex] = await this.$select({
                    title: labels.currentSSID(),
                    message: labels.currentSSIDDescribe(),
                    items: [...ssids, labels.cancel()]
                });
                if (selectedIndex !== ssids.length) electron.clipboard.writeText(ssids[selectedIndex]);
            },
            async handleOpenActionScriptsConsoleFile() {
                const logPath = await this.getScriptLogPath();
                if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, "");
                electron.shell.openPath(logPath);
            },
            async handleEditProfileParsers() {
                await this.edit("profileParsersText", "parsers: # array\n");
            },
            async handleOpenConsoleFile() {
                const logPath = await this.getParserLogPath();
                if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, "");
                electron.shell.openPath(logPath);
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
                    this.saveSettingsObject({ obj: {} });
                    this.loadSettings();
                } catch (_error) {}
            },
            handleOpenGUILog() {
                electron.shell.openPath(path.dirname(logger.transports.file.getFile().path));
            },
            async handleOpenGUIDataFolder() {
                const userDataPath = await electron.ipcRenderer.invoke("app", "getPath", "userData");
                electron.shell.showItemInFolder(userDataPath);
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
                const secret = uuid.v4();
                await updateYaml(path.join(this.clashPath, "config.yaml"), "secret", secret);
                this.reloadElectron();
            }
        },
        mounted() {
            const sectionElements = this.$refs["mixin-scroll-content"].children;
            this.sections = [...sectionElements].map(section => section.children[0].innerText);
        },
        beforeRouteLeave(_route, _previousRoute, next) { next(); }
    };
}

module.exports = { createExternalEditor, createSettingsPageOptions };
