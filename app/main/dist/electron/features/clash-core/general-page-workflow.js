"use strict";

const { parsePort, buildDashboardUrl } = require("./general-settings");
const { normalizeCoreVersion } = require("./core-api-compat");

const DEFAULT_MIXIN = `mixin: # object
  dns:
    enable: true
    listen: :53
    enhanced-mode: fake-ip
    nameserver:
      - 8.8.8.8
    fallback:
      - 8.8.4.4
    fake-ip-filter:
      - +.stun.*.*
      - +.stun.*.*.*
      - +.stun.*.*.*.*
      - +.stun.*.*.*.*.*
      - " *.n.n.srv.nintendo.net"
      - +.stun.playstation.net
      - xbox.*.*.microsoft.com
      - "*.*.xboxlive.com"
      - "*.msftncsi.com"
      - "*.msftconnecttest.com"
      - WORKGROUP
`;

const DEFAULT_MIXIN_CODE = `module.exports.parse = ({ content, name, url }, { yaml, axios, notify }) => {
  return content
}`;

function createGeneralPageWorkflow({
    getLanguage,
    path,
    fs,
    moment,
    yaml,
    httpClient,
    zlib,
    tarStream,
    childProcess,
    sudoExec,
    electron,
    cache,
    keys,
    getNetworkInterfaces,
    platform,
    updateApplication,
    logger,
    connectedStatus,
    service,
    firewall,
    utilities,
    ensureMixinDefaults,
    validateMixinSettings,
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
        systemProxyLoading: true,
        autoLaunch: cache.get(keys.AUTO_LAUNCH) || false,
        autoLaunchLoading: true,
        protableMode: false,
        version: "",
        clashCoreVersion: "",
        serviceNeedUpdate: false,
        isTunSettingsVisible: false,
        isInterfacesVisible: false,
        isFetchingFirewallRule: false,
        isResetDNSSettingsVisible: false
    });

    const watch = {
        status() { this.setupSwitches(); },
        mixedPort(value) { if (value) this.port = value; },
        isWindowShow(value) { if (value) { this.setupComponent(); this.setupSwitches(); } },
        isLaunching(value) { if (!value) this.setupComponent(); },
        clashStatus(value) { if (value === connectedStatus) this.setupComponent(); },
        clashPath() { this.serviceNeedUpdate = service.needUpdate(); }
    };

    const computed = {
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
        handleTitleClick() { electron.ipcRenderer.invoke("window", "reload"); },
        handleShowDNSQueryDialog() { this.$dns().catch(() => {}); },
        handleShowScriptTestDialog() { this.$script({}).catch(() => {}); },
        handlePreviewCurrentPayload() {
            this.$code({ code: yaml.stringify(this.currentProfilePayload), readOnly: true }).catch(() => {});
        },
        async handleAddFirewallRules() {
            if (this.isFetchingFirewallRule) return;
            this.isFetchingFirewallRule = true;
            try {
                if (this.isFirewallRuleExist) await firewall.remove();
                else await firewall.add();
            } catch (_error) {}
            this.setIsFirewallRuleExist({ isExist: await firewall.status() });
            this.isFetchingFirewallRule = false;
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
            const labels = getLanguage();
            const items = [labels.install(), labels.uninstall()];
            if (this.serviceNeedUpdate) items.push(labels.update());
            const [selection, method] = await this.$select({
                title: labels.serviceManagement(),
                message: `${labels.serviceManagementDescribe()}${this.isLocalMode ? labels.inactive() : labels.active()}`,
                items,
                subSelectItems: platform.isWindows() ? [`schtasks(${labels.recommended()})`, "winsw"] : [],
                subSelectTitle: labels.installMethod()
            });
            try {
                if (selection === 0) {
                    if (!this.isLocalMode) {
                        await utilities.showMessageBox({ type: "error", message: "The service is already installed." });
                        return;
                    }
                    await service.install(method);
                    if (!this.devMode) this.reloadElectron();
                }
                if (selection === 1) {
                    await service.uninstall();
                    if (!this.devMode) this.reloadElectron();
                }
                if (selection === 2) {
                    await service.update();
                    if (!this.devMode) this.reloadElectron();
                }
            } catch (error) {
                const [action] = await this.$select({
                    title: `${labels.failTo()}${items[selection].toLowerCase()}${labels.serviceMode()}`,
                    message: error.message,
                    items: [labels.reloadAPP(), labels.cancel()]
                });
                if (action === 0) this.reloadElectron();
            }
        },
        async handleAllowLANChange() {
            const next = !this.isAllowLan;
            const response = await this.clashApi.patchConfig({ "allow-lan": next });
            if (response.status === 204) {
                this.isAllowLan = next;
                await utilities.updateYaml(path.join(this.clashPath, "config.yaml"), "allow-lan", next);
                this.setConfData({ data: { ...this.confData, "allow-lan": next } });
            }
        },
        async handleIPV6Change() {
            const next = !this.isIPV6;
            const response = await this.clashApi.patchConfig({ ipv6: next });
            if (response.status === 204) {
                this.isIPV6 = next;
                await utilities.updateYaml(path.join(this.clashPath, "config.yaml"), "ipv6", next);
                this.setConfData({ data: { ...this.confData, ipv6: next } });
            }
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
        handleMixinSwitchClick() {
            try {
                if (!this.isMixinEnable) {
                    ensureMixinDefaults(this.settings);
                    validateMixinSettings(this.settings, { parseYaml: yaml.parse });
                }
                this.changeIsMixinEnable({ isMixin: !this.isMixinEnable });
            } catch (error) {
                console.error("toggle mixin failed:", error);
                utilities.notify("Mixin", error.message, { silent: false });
            }
        },
        async handleTunSwitchClick() { this.changeIsTunEnable({ isTun: !this.isTunEnable }); },
        async handleSystemProxySwitchClick() {
            const labels = getLanguage();
            if (this.systemProxyLoading) return;
            this.systemProxyLoading = true;
            const next = !this.isSystemProxyOn;
            if (await this.$setSystemProxy(next, this.confData)) {
                this.setIsSystemProxyOn({ isOn: next });
            } else if (platform.isMacOS() && this.isLocalMode) {
                const { response } = await utilities.showMessageBox({
                    type: "error",
                    message: `${labels.makeSureYouHave()}${this.serviceNeedUpdate ? labels.updated() : labels.installed()} ${labels.serviceModeCtrlSysProxy()}`,
                    buttons: [`${this.serviceNeedUpdate ? labels.update() : labels.install()} ${labels.now()}`, "Later"]
                });
                try {
                    if (response === 0) {
                        if (this.serviceNeedUpdate) await service.update();
                        else await service.install();
                        if (!this.$parent.devMode) this.reloadElectron();
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
            this.systemProxyLoading = false;
        },
        async handleAutoLaunchSwitchClick() {
            const next = !this.autoLaunch;
            if (this.autoLaunchLoading) return;
            this.autoLaunchLoading = true;
            this.$setAutoLaunch(next);
            this.autoLaunch = next;
            cache.put(keys.AUTO_LAUNCH, next);
            this.autoLaunchLoading = false;
        },
        async installTapDevice() {
            if (!platform.isWindows()) return;
            const labels = getLanguage();
            try {
                const [selection] = await this.$select({
                    title: labels.TAPdeviceManagement(), message: labels.TAPinstallDescribe(),
                    items: [labels.install(), labels.uninstall(), labels.customize()]
                });
                if (selection === 0) {
                    try {
                        await this.$parent.setupTapDevice(true);
                        utilities.notify(labels.success(), labels.tapDeviceInstalled(), true);
                        if (this.isMixinEnable || this.isTunEnable) this.$parent.refreshProfile();
                    } catch (_error) { utilities.notify(labels.failed(), labels.notInstallTapDevice(), true); }
                } else if (selection === 1) {
                    try {
                        await this.$parent.setupTapDevice(false);
                        utilities.notify(labels.success(), labels.tapDeviceRemoved(), true);
                    } catch (_error) { utilities.notify(labels.failed(), labels.notRemoveTapDevice(), true); }
                } else if (selection === 2) {
                    const { ip, subnet, gateway } = cache.get(keys.TAP_INFO) ?? {};
                    try {
                        const result = await this.$input({
                            title: labels.deviceTAP(),
                            data: [
                                { name: labels.IPaddress(), key: "ip", placeholder: "10.0.0.1", value: ip ?? "" },
                                { name: labels.subnetMask(), key: "subnet", placeholder: "255.255.255.0", value: subnet ?? "" },
                                { name: labels.defaultGateway(), key: "gateway", placeholder: "10.0.0.0", value: gateway ?? "" }
                            ],
                            hint: labels.reinstallDescribeWithTAP()
                        });
                        cache.put(keys.TAP_INFO, result);
                    } catch (_error) {}
                    this.installTapDevice();
                }
            } catch (_error) {}
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
                        const terminals = ["cmd", "powershell", "wt"];
                        const exec = checks[0].value ? sudoExec : childProcess.exec;
                        exec(`start ${terminals[selection]}`, {
                            cwd: this.$parent.userPath,
                            windowsHide: true,
                            env: {
                                http_proxy: `http://127.0.0.1:${this.port}`,
                                https_proxy: `http://127.0.0.1:${this.port}`
                            }
                        });
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
                        validate: value => parsePort(value) !== null ? "" : "Port must be an integer between 1 and 65535"
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
            electron.shell.openExternal(buildDashboardUrl({ controllerPort: this.controllerPort, secret: this.secret }));
        },
        spawnLoopback() {
            if (platform.isWindows()) electron.shell.openPath(path.join(this.filesPath, "win", "common", "EnableLoopback.exe"));
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
            const { url, version, log, releasePage, reactions, reactionClick } = this.$parent.newVersionInfo;
            if (!url) {
                this.$alert({ title: labels.nowVersionUpToDate(), content: labels.nowVersionUpToDateDescribe() });
                return;
            }
            const [selection] = await this.$select({
                title: `${version}${labels.hadBeenReleased()}`,
                message: log,
                reactions,
                reactionClick,
                items: [labels.download(), labels.copyURL(), labels.cancel()]
            });
            if (selection === 0) {
                await electron.shell.openExternal(releasePage);
            } else if (selection === 1) electron.clipboard.writeText(releasePage);
        },
        handleHomeDirectoryOpen() { electron.shell.openPath(path.resolve(this.clashPath)); },
        handleGeoipDatabaseUpdate() { this.updateGeoipDB(); },
        async handlePortClick() {
            const labels = getLanguage();
            const customCommand = async fallback => {
                const cached = cache.get(keys.SYSTEM_PROXY_COMMAND);
                const result = await this.$input({
                    title: labels.copyCommand(),
                    data: [{ name: "", key: "command", placeholder: "", value: cached || fallback }],
                    hint: "", confirmText: "Copy"
                }).catch(() => undefined);
                if (!result) return "";
                const command = result.command;
                cache.put(keys.SYSTEM_PROXY_COMMAND, command || "");
                return (command || "")
                    .replace(/%mixedPort%/g, this.port)
                    .replace(/%(.+?)%/g, token => (getNetworkInterfaces().find(item => item.name === token.slice(1, -1)) || {}).address || "");
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
            try { fs.unlinkSync(path.join(this.clashPath, "config.yaml")); } catch (_error) {}
            try { fs.unlinkSync(path.join(this.clashPath, "country.mmdb")); } catch (_error) {}
            await this.reloadElectron();
        },
        async updateGeoipDB() {
            const labels = getLanguage();
            if (platform.isWindows()) {
                this.$alert({ content: labels.updatingDbNotAllowedCFW(), title: "Note" });
                return;
            }
            const originalTime = this.geoipUpdateTime;
            if (/^Updating/.test(originalTime)) return;
            try {
                const { url = "", token = "" } = await this.$input({
                    title: labels.updateDbGeoIP(),
                    data: [
                        { name: "MaxMind User License Key", key: "token", placeholder: "", value: cache.get(keys.GEOIP_TOKEN) || "" },
                        { name: "URL", key: "url", placeholder: "", value: cache.get(keys.GEOIP_URL) || "https://github.com/Dreamacro/maxmind-geoip/releases/latest/download/Country.mmdb" }
                    ],
                    hint: labels.inputFieldAlternative()
                });
                cache.put(keys.GEOIP_TOKEN, token);
                cache.put(keys.GEOIP_URL, url);
                if (!this.clashPath) return;
                const finish = (target, size) => {
                    fs.ftruncateSync(fs.openSync(target, "r+"), size);
                    this.$parent.handlerRestartClash();
                };
                if (token) {
                    this.geoipUpdateTime = `${labels.updating()}... (0%)`;
                    const temp = await electron.ipcRenderer.invoke("app", "getPath", "temp");
                    const stream = httpClient.stream(`https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=${token}&suffix=tar.gz`);
                    stream.on("downloadProgress", progress => {
                        this.geoipUpdateTime = progress.percent === 1 ? labels.restartingCore() : `${labels.updating()}... (${Math.round(100 * progress.percent)}%)`;
                    });
                    stream.on("error", error => {
                        this.$alert({ content: `${labels.downloadDbErrGeoIP()}: ${error.name}` });
                        this.geoipUpdateTime = originalTime;
                    });
                    path.join(temp, "cfw_geoip.tag.gz");
                    const target = path.join(this.clashPath, "Country.mmdb");
                    const archive = tarStream.extract();
                    let size = 0;
                    archive.on("entry", (header, entry, next) => {
                        entry.on("end", next);
                        if (/GeoLite2-Country\.mmdb$/.test(header.name)) {
                            size = header.size;
                            entry.pipe(fs.createWriteStream(target, { flags: "r+" }));
                        } else entry.resume();
                    });
                    archive.on("finish", () => finish(target, size));
                    stream.pipe(zlib.createGunzip()).pipe(archive);
                } else if (url) {
                    this.geoipUpdateTime = `${labels.updating()}... (0%)`;
                    const stream = httpClient.stream(url);
                    let size = 0;
                    stream.on("downloadProgress", progress => {
                        if (progress.percent === 1) {
                            size = progress.total;
                            this.geoipUpdateTime = labels.restartingCore();
                        } else this.geoipUpdateTime = `Updating... (${Math.round(100 * progress.percent)}%)`;
                    });
                    stream.on("error", error => {
                        this.$alert({ content: `${labels.downloadDbErrGeoIP()}: ${error.name}` });
                        this.geoipUpdateTime = originalTime;
                    });
                    const target = path.join(this.clashPath, "Country.mmdb");
                    const output = fs.createWriteStream(target, { flags: "r+" });
                    output.on("finish", () => finish(target, size));
                    stream.pipe(output);
                }
            } catch (_error) {}
        },
        setupSwitches() { this.autoLaunchLoading = false; this.systemProxyLoading = false; },
        async setupComponent() {
            if (!this.clashApi.isReady()) return;
            try {
                const [{ status, data }] = await Promise.all([this.clashApi.getConfig(), this.fetchCoreVersion()]);
                if (status === 200) {
                    this.port = data["mixed-port"];
                    this.isAllowLan = data["allow-lan"];
                    this.bindAddress = data["bind-address"];
                    this.logLevel = data["log-level"];
                    this.isIPV6 = data.ipv6;
                    this.geoipUpdateTime = moment(fs.statSync(path.join(this.clashPath, "Country.mmdb")).mtimeMs).format("YYYY-MM-DD HH:mm");
                }
            } catch (error) { console.error(error.stack); }
        },
        async fetchCoreVersion() {
            if (!this.clashApi.isReady()) return;
            const response = await this.clashApi.getVersion();
            this.clashCoreVersion = normalizeCoreVersion(response.data, this.settings.proxyCore);
        }
    };

    async function mounted() {}

    function beforeRouteEnter(_to, _from, next) {
        next(async vm => {
            vm.version = `v${await electron.ipcRenderer.invoke("app", "getVersion")}`;
            vm.serviceNeedUpdate = service.needUpdate();
            vm.setupComponent();
            schedule(vm.setupSwitches, 1);
        });
    }

    function beforeRouteLeave(_to, _from, next) { next(); }

    return { data, watch, computed, methods, mounted, beforeRouteEnter, beforeRouteLeave };
}

module.exports = { DEFAULT_MIXIN, DEFAULT_MIXIN_CODE, createGeneralPageWorkflow };
