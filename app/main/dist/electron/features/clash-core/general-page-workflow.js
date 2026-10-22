"use strict";

const { parsePort, buildDashboardUrl } = require("./general-settings");
const { isIPv4 } = require("../../core/network/browser-ip");
const { normalizeCoreVersion } = require("./core-api-compat");
const { supportsScriptMode } = require("../../core/clash-core/core-capabilities");
const { TAP_MODES, resolveTapMode } = require("../../core/network/legacy-tap-policy");

const { DEFAULT_YAML_MIXIN: DEFAULT_MIXIN, DEFAULT_CODE_MIXIN: DEFAULT_MIXIN_CODE } = require("../../core/config/mixin-defaults");

function createGeneralPageWorkflow({
    getLanguage,
    path,
    moment,
    yaml,
    terminal,
    coreConfigRepository,
    electron,
    cache,
    keys,
    getNetworkInterfaces,
    getTapInstalled = async () => false,
    getNetworkDiagnostics = () => [],
    platform,
    connectedStatus,
    service,
    firewall,
    utilities,
    schedule = setTimeout,
    repeat = setInterval
}) {
    const data = () => ({
        iconPath: "static/imgs/logo2.png",
        title: "Clash for Windows",
        isAllowLan: false,
        bindAddress: "",
        port: 0,
        logLevel: "unknow",
        isIPV6: false,
        geoipUpdateTime: "",
        geoipUpdating: false,
        systemProxyLoading: true,
        autoLaunch: cache.get(keys.AUTO_LAUNCH) || false,
        autoLaunchLoading: true,
        autoLaunchPending: false,
        protableMode: false,
        version: "",
        clashCoreVersion: "",
        coreVersionRequest: 0,
        serviceNeedUpdate: false,
        serviceDialogOpen: false,
        allowLanLoading: false,
        ipv6Loading: false,
        isTunSettingsVisible: false,
        isInterfacesVisible: false,
        isFetchingFirewallRule: false,
        isResetDNSSettingsVisible: false,
        isTapManagementVisible: false, tapInstalled: null, tapStatusRequest: 0
    });

    const watch = {
        status() { this.setupSwitches(); },
        mixedPort(value) { if (value) this.port = value; },
        isWindowShow(value) { if (value) { this.setupComponent(); this.setupSwitches(); } },
        isLaunching(value) { if (!value) this.setupComponent(); },
        clashStatus(value) {
            this.invalidateCoreVersion();
            if (value === connectedStatus) this.setupComponent();
        },
        "settings.proxyCore"() { this.invalidateCoreVersion(); },
        "$parent.isCoreRestarting"(value) { if (value) this.invalidateCoreVersion(); },
        async clashPath() { this.serviceNeedUpdate = await service.needUpdate(); }
    };

    const computed = {
        scriptModeVisible() { return supportsScriptMode(this.settings.proxyCore); },
        proxyBusy() { return this.$parent.proxyBusy; },
        tunLoading() { return this.$parent.proxyOperation === "tun"; },
        mixinLoading() { return this.$parent.proxyOperation === "mixin"; },
        tapLoading() { return this.$parent.proxyOperation === "tap"; },
        legacyTapMode() { return resolveTapMode(this.settings); },
        networkStateKnown() { return this.clashStatus === connectedStatus && Object.keys(this.currentProfilePayload || {}).length > 0; },
        networkWarnings() { return this.networkStateKnown ? getNetworkDiagnostics(this) : []; },
        systemProxyBusy() { return this.systemProxyLoading || this.$parent.proxyOperation === "system"; },
        autoLaunchHint() {
            const labels = getLanguage();
            return platform.isMacOS() ? labels.startWithMacOS()
                : platform.isWindows() ? labels.startWithWindows()
                    : platform.isLinux() ? labels.startWithLinux() : undefined;
        },
        isShowNewIcon() {
            const show = this.settings.showNewVersionIcon ?? true;
            return show && this.$parent.newVersionInfo.url;
        }
    };

    const methods = {
        handleTapModeChange(mode) {
            if (this.proxyBusy || !TAP_MODES.includes(mode)) return false;
            return this.$parent.requestProfileToggle("tap", mode);
        },
        async refreshTapStatus() {
            if (!platform.isWindows()) return;
            const request = this.tapStatusRequest = (this.tapStatusRequest || 0) + 1;
            try {
                const installed = await getTapInstalled();
                if (request === this.tapStatusRequest) this.tapInstalled = installed === true;
            } catch (_error) { if (request === this.tapStatusRequest) this.tapInstalled = null; }
        },
        handleTitleClick() { electron.ipcRenderer.invoke("window", "reload"); },
        handleShowDNSQueryDialog() { this.$dns().catch(() => {}); },
        handleShowScriptTestDialog() {
            if (!supportsScriptMode(this.settings.proxyCore)) return false;
            return this.$script({}).catch(() => {});
        },
        async handlePreviewCurrentPayload() {
            const labels = getLanguage();
            const state = this.networkStateKnown
                ? `${labels.networkAppliedState()} TUN: ${this.currentProfilePayload.tun?.enable ? labels.networkEnabled() : labels.networkDisabled()} · TAP: ${this.$parent.tun2socks ? labels.networkEnabled() : labels.networkDisabled()}`
                : labels.networkStateUnavailable();
            const message = [state, ...(this.proxyBusy ? [labels.networkApplying()] : []),
                ...this.networkWarnings.map(key => labels[key]())].join("\n\n");
            try {
                const [selection] = await this.$select({ title: labels.networkConfiguration(), message,
                    items: [labels.previewSubmittedConfiguration(), labels.cancel()], isLastDifferent: true });
                if (selection === 0) await this.$code({ code: yaml.stringify(this.currentProfilePayload), readOnly: true });
            } catch (_cancelled) {}
        },
        async handleAddFirewallRules() {
            if (this.isFetchingFirewallRule) return;
            this.isFetchingFirewallRule = true;
            try {
                try {
                    if (this.isFirewallRuleExist) await firewall.remove();
                    else await firewall.add();
                } catch (_error) {}
                this.setIsFirewallRuleExist({ isExist: await firewall.status() });
            } finally { this.isFetchingFirewallRule = false; }
        },
        async handleEditMixin() {
            const { mixinText = DEFAULT_MIXIN, mixinType = 0, mixinCode = DEFAULT_MIXIN_CODE } = this.settings;
            try {
                const { code = "" } = await this.$code({
                    code: mixinType === 0 ? mixinText : mixinCode,
                    language: mixinType === 0 ? "yaml" : "javascript",
                    fontSize: this.settings.editorFontSize
                });
                if (code !== (mixinType === 0 ? mixinText : mixinCode)) {
                    if (mixinType === 0) this.settings.mixinText = code;
                    else this.settings.mixinCode = code;
                }
            } catch (_error) {}
        },
        async handleEditSSIDStrategyText() {
            const original = this.settings.ssidStrategyText;
            try {
                const { code = "" } = await this.$code({ code: original, language: "yaml", fontSize: this.settings.editorFontSize });
                if (code !== original) {
                    this.settings.ssidStrategyText = code;
                    this.$parent.setSSIDOptions();
                }
            } catch (_error) {}
        },
        async installService() {
            if (this.serviceDialogOpen || this.proxyBusy) return;
            this.serviceDialogOpen = true;
            const labels = getLanguage();
            const items = [labels.install(), labels.uninstall()];
            if (this.serviceNeedUpdate) items.push(labels.update());
            let selection;
            try {
                const [selected, method] = await this.$select({
                    title: labels.serviceManagement(),
                    message: `${labels.serviceManagementDescribe()}${this.isLocalMode ? labels.inactive() : labels.active()}`,
                    items,
                    subSelectItems: platform.isWindows() ? [`schtasks(${labels.recommended()})`, "winsw"] : [],
                    subSelectTitle: labels.installMethod()
                });
                selection = selected;
                if (selection === 0) {
                    if (!this.isLocalMode) {
                        await utilities.showMessageBox({ type: "error", message: labels.serviceAlreadyInstalled() });
                        return;
                    }
                    await this.applyServiceChange("install", method);
                }
                if (selection === 1) {
                    await this.applyServiceChange("uninstall");
                }
                if (selection === 2) {
                    await this.applyServiceChange("update");
                }
            } catch (error) {
                if (selection === undefined) return;
                const [action] = await this.$select({
                    title: `${labels.failTo()}${items[selection].toLowerCase()}${labels.serviceMode()}`,
                    message: error.message,
                    items: [labels.reloadAPP(), labels.cancel()]
                });
                if (action === 0) {
                    this.$parent.serviceOperation = "restarting";
                    try { await this.reloadElectron(); }
                    catch (reloadError) { this.$parent.serviceOperation = ""; throw reloadError; }
                }
            } finally {
                this.serviceDialogOpen = false;
            }
        },
        async applyServiceChange(action, method) {
            const home = this.$parent;
            if (home.proxyBusy) return false;
            home.serviceOperation = "applying";
            try {
                await this.$nextTick();
                await service[action](method);
                if (this.devMode) home.serviceOperation = "";
                else {
                    home.serviceOperation = "restarting";
                    await this.$nextTick();
                    await this.reloadElectron();
                    // Keep the blocker until the old renderer exits, including quit cleanup.
                }
                return true;
            } catch (error) {
                home.serviceOperation = "";
                throw error;
            }
        },
        async handleAllowLANChange() {
            if (this.allowLanLoading || this.proxyBusy) return;
            this.allowLanLoading = true;
            try {
                return await this.$parent.runProxyOperation("allow-lan", async () => {
                    const next = !this.isAllowLan;
                    const response = await this.clashApi.patchConfig({ "allow-lan": next });
                    if (response.status !== 204) throw new Error(`Could not apply Allow LAN (${response.status})`);
                    this.isAllowLan = next;
                    await utilities.updateYaml(path.join(this.clashPath, "config.yaml"), "allow-lan", next);
                    this.setConfData({ data: { ...this.confData, "allow-lan": next } });
                }, !this.isAllowLan);
            } finally { this.allowLanLoading = false; }
        },
        async handleIPV6Change() {
            if (this.ipv6Loading || this.proxyBusy) return;
            this.ipv6Loading = true;
            try {
                return await this.$parent.runProxyOperation("ipv6", async () => {
                    const next = !this.isIPV6;
                    const response = await this.clashApi.patchConfig({ ipv6: next });
                    if (response.status !== 204) throw new Error(`Could not apply IPv6 (${response.status})`);
                    this.isIPV6 = next;
                    await utilities.updateYaml(path.join(this.clashPath, "config.yaml"), "ipv6", next);
                    this.setConfData({ data: { ...this.confData, ipv6: next } });
                }, !this.isIPV6);
            } finally { this.ipv6Loading = false; }
        },
        async handleEditLogLevel() {
            const labels = getLanguage();
            try {
                const levels = ["silent", "error", "warning", "info", "debug"];
                const [selection] = await this.$select({
                    title: labels.changeLogLevel(), message: labels.silentDescribe(), items: labels.logLevelSelection()
                });
                const level = levels[selection];
                const response = await this.clashApi.patchConfig({ "log-level": level });
                if (response.status === 204) {
                    this.logLevel = level;
                    await utilities.updateYaml(path.join(this.clashPath, "config.yaml"), "log-level", level);
                    this.setConfData({ data: { ...this.confData, "log-level": level } });
                }
            } catch (_error) {}
        },
        async handleMixinSwitchClick() {
            return this.$parent.requestProfileToggle("mixin", !this.isMixinEnable);
        },
        async handleTunSwitchClick() { return this.$parent.requestProfileToggle("tun", !this.isTunEnable); },
        async handleSystemProxySwitchClick() {
            const labels = getLanguage();
            if (this.systemProxyBusy || this.proxyBusy) return;
            const next = !this.isSystemProxyOn;
            if (!await this.$parent.requestSystemProxy(next) && platform.isMacOS() && this.isLocalMode) {
                const { response } = await utilities.showMessageBox({
                    type: "error",
                    message: `${labels.makeSureYouHave()}${this.serviceNeedUpdate ? labels.updated() : labels.installed()} ${labels.serviceModeCtrlSysProxy()}`,
                    buttons: [`${this.serviceNeedUpdate ? labels.update() : labels.install()} ${labels.now()}`, labels.later()]
                });
                try {
                    if (response === 0) {
                        await this.applyServiceChange(this.serviceNeedUpdate ? "update" : "install");
                    }
                } catch (error) {
                    const [selection] = await this.$select({
                        title: `${labels.failTo()}${this.serviceNeedUpdate ? labels.update() : labels.install()} ${labels.server()}`,
                        message: error.message,
                        items: [labels.reloadAPP(), labels.cancel()]
                    });
                    if (selection === 0) this.reloadElectron();
                }
            }
        },
        async handleAutoLaunchSwitchClick() {
            const next = !this.autoLaunch;
            if (this.autoLaunchLoading || this.autoLaunchPending) return;
            this.autoLaunchLoading = true;
            this.autoLaunchPending = true;
            try {
                await this.$setAutoLaunch(next);
                this.autoLaunch = next;
                cache.put(keys.AUTO_LAUNCH, next);
                return true;
            } catch (_error) {
                await utilities.showMessageBox({ type: "error", message: getLanguage().failed() });
                return false;
            } finally { this.autoLaunchLoading = false; this.autoLaunchPending = false; }
        },
        async installTapDevice() {
            if (!platform.isWindows() || this.proxyBusy) return false;
            this.isTapManagementVisible = true;
            await this.refreshTapStatus();
        },
        async handleTapManagementAction(selection) {
            if (!platform.isWindows() || this.proxyBusy || ![0, 1, 2].includes(selection)) return false;
            const labels = getLanguage();
            return this.$parent.runProxyOperation("tap", async () => {
                try {
                    if (selection === 2) {
                        const { ip, subnet, gateway } = cache.get(keys.TAP_INFO) ?? {};
                        try {
                            const result = await this.$input({
                                title: labels.deviceTAP(),
                                data: [
                                    { name: labels.IPaddress(), key: "ip", placeholder: "10.0.0.1", value: ip ?? "", validate: value => value === "" || isIPv4(value) ? "" : labels.ipv4Required() },
                                    { name: labels.subnetMask(), key: "subnet", placeholder: "255.255.255.0", value: subnet ?? "", validate: value => value === "" || isIPv4(value) ? "" : labels.ipv4Required() },
                                    { name: labels.defaultGateway(), key: "gateway", placeholder: "10.0.0.0", value: gateway ?? "", validate: value => value === "" || isIPv4(value) ? "" : labels.ipv4Required() }
                                ],
                                hint: labels.reinstallDescribeWithTAP()
                            });
                            cache.put(keys.TAP_INFO, result);
                        } catch (_error) {}
                    }
                    if (selection !== 2) {
                        let setupError;
                        try {
                            if (await this.$parent.setupTapDevice(selection === 0) === false) {
                                throw new Error(selection === 0 ? labels.notInstallTapDevice() : labels.notRemoveTapDevice());
                            }
                        } catch (error) { setupError = error; }
                        // A cancelled elevation can leave the driver installed after
                        // its owned process was stopped. Reapply the current policy.
                        const result = this.$parent.refreshTapAfterSetup
                            ? await this.$parent.refreshTapAfterSetup(setupError ? undefined : selection === 0)
                            : await this.$parent.refreshProfile();
                        if (setupError) throw setupError;
                        if (!result.success && result.message) throw new Error(result.message);
                        utilities.notify(labels.success(), selection === 0 ? labels.tapDeviceInstalled() : labels.tapDeviceRemoved(), true);
                    }
                    return true;
                } finally { await this.refreshTapStatus(); }
            });
        },
        async openCmdWithProxy() {
            const labels = getLanguage();
            try {
                if (platform.isMacOS() || platform.isLinux()) {
                    this.handlePortClick();
                } else if (platform.isWindows()) {
                    const [selection, checks] = await this.$select({
                        title: labels.openTerminalSetProxy(), message: labels.selectTterminal(),
                        items: ["CMD", "Powershell", "Windows Terminal", labels.copyCommandsOnly()],
                        checkList: [{ key: labels.runAsAdmin(), value: false }]
                    });
                    if (selection === 3) this.handlePortClick();
                    else {
                        await terminal.open(selection, checks[0].value === true, this.port);
                    }
                }
            } catch (_error) {}
        },
        async handleEditMixedPort() {
            const labels = getLanguage();
            try {
                const result = await this.$input({
                    title: labels.changeMixedPort(),
                    data: [{
                        name: labels.newPort(), key: "port", placeholder: this.port, value: "",
                        validate: value => parsePort(value) !== null ? "" : labels.invalidPort()
                    }],
                    hint: "mixed = http + socks"
                });
                const port = parsePort(result.port);
                if (port !== null && (await this.clashApi.patchConfig({ "mixed-port": port })).status === 204) {
                    this.port = port;
                    this.settings.randomMixedPort = false;
                    await utilities.updateYaml(path.join(this.clashPath, "config.yaml"), "mixed-port", port);
                    this.setConfData({ data: { ...this.confData, "mixed-port": port } });
                }
            } catch (_error) {}
            this.setupComponent();
        },
        async handleEditBindAddress() {
            const labels = getLanguage();
            try {
                const { address } = await this.$input({
                    title: labels.changeBindAddress(),
                    data: [{ name: labels.newBindAddress(), key: "address", placeholder: this.bindAddress, value: "", validate: () => "" }],
                    hint: labels.changeBindAddressDescribe()
                });
                if (address && (await this.clashApi.patchConfig({ "bind-address": address })).status === 204) {
                    this.bindAddress = address;
                    await utilities.updateYaml(path.join(this.clashPath, "config.yaml"), "bind-address", address);
                    this.setConfData({ data: { ...this.confData, "bind-address": address } });
                }
            } catch (_error) {}
            this.setupComponent();
        },
        handleCopyControllerURL() {
            return electron.shell.openExternal(buildDashboardUrl({ controllerPort: this.controllerPort, secret: this.secret }));
        },
        spawnLoopback() {
            if (platform.isWindows()) return terminal.loopback();
        },
        async openGithubRelease() {
            const labels = getLanguage();
            if (platform.isMacOS() && this.isSilentUpgraded) {
                const [selection] = await this.$select({
                    title: labels.automaticUpgradeCompleted(), message: labels.askRestartAPP(),
                    items: [labels.restart(), labels.cancel()]
                });
                if (selection === 0) await this.reloadElectron();
                return;
            }
            await this.$parent.checkForUpdate();
            const { url, version, displayVersion, log, releasePage, reactions, reactionClick } = this.$parent.newVersionInfo;
            if (!url) {
                this.$alert({ title: labels.nowVersionUpToDate(), content: labels.nowVersionUpToDateDescribe() });
                return;
            }
            const [selection] = await this.$select({
                title: `${displayVersion || version}${labels.hadBeenReleased()}`,
                message: log,
                reactions,
                reactionClick,
                items: [labels.download(), labels.copyURL(), labels.cancel()]
            });
            if (selection === 0) {
                await electron.shell.openExternal(releasePage);
            } else if (selection === 1) electron.clipboard.writeText(releasePage);
        },
        handleHomeDirectoryOpen() { return electron.ipcRenderer.invoke("application-folder", "home", this.clashPath); },
        handleGeoipDatabaseUpdate() { this.updateGeoipDB(); },
        async handlePortClick() {
            const labels = getLanguage();
            const customCommand = async fallback => {
                const cached = cache.get(keys.SYSTEM_PROXY_COMMAND);
                const result = await this.$input({
                    title: labels.copyCommand(),
                    data: [{ name: "", key: "command", placeholder: "", value: cached || fallback }],
                    hint: "", confirmText: labels.copy()
                }).catch(() => undefined);
                if (!result) return "";
                const command = result.command;
                cache.put(keys.SYSTEM_PROXY_COMMAND, command || "");
                const interfaces = await getNetworkInterfaces();
                return (command || "")
                    .replace(/%mixedPort%/g, this.port)
                    .replace(/%(.+?)%/g, token => (interfaces.find(item => item.name === token.slice(1, -1)) || {}).address || "");
            };
            let command;
            if (platform.isMacOS() || platform.isLinux()) {
                command = await customCommand("export https_proxy=http://127.0.0.1:%mixedPort%;export http_proxy=http://127.0.0.1:%mixedPort%;export all_proxy=socks5://127.0.0.1:%mixedPort%");
            } else if (platform.isWindows()) {
                try {
                    const [selection] = await this.$select({
                        title: labels.copyProxySettingCommands(), message: labels.selectTterminal(),
                        items: ["CMD", "Powershell", labels.custom()]
                    });
                    if (selection === 0) command = `set http_proxy=http://127.0.0.1:${this.port} & set https_proxy=http://127.0.0.1:${this.port}`;
                    else if (selection === 1) command = `$Env:http_proxy="http://127.0.0.1:${this.port}";$Env:https_proxy="http://127.0.0.1:${this.port}"`;
                    else command = await customCommand("export https_proxy=http://127.0.0.1:%mixedPort%;export http_proxy=http://127.0.0.1:%mixedPort%;export all_proxy=socks5://127.0.0.1:%mixedPort%");
                } catch (_error) {}
            }
            if (command) {
                electron.clipboard.writeText(command);
                utilities.notify(`${labels.cmmandsInCopied()}!`, command, true);
            }
        },
        async autoFix() {
            try { await coreConfigRepository.reset(this.clashPath); } catch (_error) {}
            await this.reloadElectron();
        },
        async updateGeoipDB() {
            const labels = getLanguage();
            if (platform.isWindows()) {
                this.$alert({ content: labels.updatingDbNotAllowedCFW(), title: labels.note() });
                return;
            }
            const originalTime = this.geoipUpdateTime;
            if (this.geoipUpdating) return;
            this.geoipUpdating = true;
            let started = false;
            try {
                const { url = "", token = "" } = await this.$input({
                    title: labels.updateDbGeoIP(),
                    data: [
                        { name: labels.maxMindLicenseKey(), key: "token", placeholder: "", value: cache.get(keys.GEOIP_TOKEN) || "" },
                        { name: "URL", key: "url", placeholder: "", value: cache.get(keys.GEOIP_URL) || "https://github.com/Dreamacro/maxmind-geoip/releases/latest/download/Country.mmdb" }
                    ],
                    hint: labels.inputFieldAlternative()
                });
                cache.put(keys.GEOIP_TOKEN, token);
                cache.put(keys.GEOIP_URL, url);
                if (!this.clashPath) return;
                if (!token && !url) return;
                started = true;
                this.geoipUpdateTime = `${labels.updating()}... (0%)`;
                await coreConfigRepository.updateGeoip(this.clashPath, { url, token }, percent => {
                    this.geoipUpdateTime = percent === 1 ? labels.restartingCore() : `${labels.updating()}... (${Math.round(100 * percent)}%)`;
                });
                await this.$parent.handlerRestartClash();
            } catch (_error) {
                this.geoipUpdateTime = originalTime;
                if (started) this.$alert({ content: labels.downloadDbErrGeoIP() });
            } finally { this.geoipUpdating = false; }
        },
        setupSwitches() { if (!this.autoLaunchPending) this.autoLaunchLoading = false; this.systemProxyLoading = false; },
        async setupComponent() {
            this.refreshTapStatus();
            if (!this.clashApi.isReady() || this.clashStatus !== connectedStatus) return;
            try {
                const [{ status, data }] = await Promise.all([this.clashApi.getConfig(), this.fetchCoreVersion()]);
                if (status === 200) {
                    this.port = data["mixed-port"];
                    this.isAllowLan = data["allow-lan"];
                    this.bindAddress = data["bind-address"];
                    this.logLevel = data["log-level"];
                    this.isIPV6 = data.ipv6;
                    this.geoipUpdateTime = moment((await coreConfigRepository.metadata(this.clashPath)).geoipModifiedAt).format("YYYY-MM-DD HH:mm");
                }
            } catch (error) { console.error(error.stack); }
        },
        invalidateCoreVersion() {
            this.coreVersionRequest = (this.coreVersionRequest || 0) + 1;
            this.clashCoreVersion = "";
        },
        async fetchCoreVersion() {
            if (!this.clashApi.isReady() || this.clashStatus !== connectedStatus) return;
            const core = this.settings.proxyCore;
            const request = this.coreVersionRequest = (this.coreVersionRequest || 0) + 1;
            const response = await this.clashApi.getVersion();
            // A previous core's in-flight response must not overwrite the new version.
            if (request !== this.coreVersionRequest || core !== this.settings.proxyCore
                || this.clashStatus !== connectedStatus || response.status !== 200) return;
            this.clashCoreVersion = normalizeCoreVersion(response.data, core);
        }
    };

    async function mounted() {}

    function beforeRouteEnter(_to, _from, next) {
        next(async vm => {
            vm.version = `v${await electron.ipcRenderer.invoke("app", "getVersion")}`;
            vm.serviceNeedUpdate = await service.needUpdate();
            vm.setupComponent();
            schedule(vm.setupSwitches, 1);
        });
    }

    function beforeRouteLeave(_to, _from, next) { next(); }

    return { data, watch, computed, methods, mounted, beforeRouteEnter, beforeRouteLeave };
}

module.exports = { DEFAULT_MIXIN, DEFAULT_MIXIN_CODE, createGeneralPageWorkflow };
