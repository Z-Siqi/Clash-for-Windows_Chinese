"use strict";

const { shouldCloseWindowForShortcut } = require("./window-shortcut-policy");
const { supportsScriptMode } = require("../../core/clash-core/core-capabilities");
const { parsePort } = require("../../core/network/tcp-port");
const {
    isTcpPortAvailable,
    applyAndVerifyMixedPort,
    confirmMixedPortConflict,
    recoverWithRandomPort
} = require("../../core/network/mixed-port-recovery");

function configureLogger(logger) {
    logger.transports.console.format = message => message.data;
    logger.transports.file.format = message => `time="${message.date}" level=${message.level} msg="${message.data}"`;
}

function createMacDnsHelpers({ runMacCommand, net }) {
    return {
        async setDns(addresses) {
            const result = await runMacCommand(["-dns", addresses.length > 0 ? addresses.join(",") : "reset"]);
            return result.success;
        },
        async getDns() {
            const result = await runMacCommand(["-dns", "query"]);
            if (!result.success || !/.+?=(.+?);/.test(result.output)) return [];
            return RegExp.$1.split(",").filter(address => net.isIP(address));
        }
    };
}

async function startPacServer({ store, validatePort, getPort, Koa, defaultPac }) {
    const configuredPort = store.state.app.settings.innerServerPort;
    const port = validatePort(configuredPort) ? configuredPort : await getPort();
    const server = new Koa();
    server.use(async context => {
        const pacContent = store.state.app.settings.pacContentText || defaultPac;
        if (!/\/pac$/.test(context.path)) {
            context.res.statusCode = 404;
            return;
        }
        const mixedPort = store.getters.mixedPort;
        if (mixedPort) {
            context.set("content-type", "application/x-ns-proxy-autoconfig");
            context.body = pacContent.replace(/%mixed-port%/g, mixedPort);
        }
    });
    server.listen(port, "127.0.0.1");
    store.commit("SET_INNER_SERVER_PORT", { port });
}

function createHomePageOptions(dependencies) {
    const {
        Vuex, lodash, components, cache, keys, connectionStatus, proxyStatus,
        runtimeProcess, electron, path, fs, moment, scheduler, logger, os, httpClient,
        yaml, sudoPrompt, validatePort, notify, showMessageBox, updateYaml, hash, sleep,
        shouldReplaceWintun, detectInterface, store, defaultPac, Koa, getPort,
        downloadProfile, net, runMacCommand, uuid, firewallRuleExists, getWlanInterfaces,
        mousetrap, cron, serviceStatus, serviceActiveStatus, runtimeState, languageKey,
        getLanguage, refreshRendererProfile, createRendererConfiguration, persistSelection,
        createClashServiceApi, createTunRuntime, createClashCoreRuntime,
        isMacOS, isWindows, isLinux, currentTarget, updateTargets
    } = dependencies;
    const { setDns, getDns } = createMacDnsHelpers({ runMacCommand, net });

    configureLogger(logger);

    return {
        name: "landing-page",
        components,
        data() {
            return {
                clash: null,
                userPath: "",
                clashRestfulPort: null,
                clashRestfulSecret: "",
                newVersionInfo: {},
                shwoError: false,
                showStartup: false,
                portableMode: false,
                startTime: null,
                tun2socks: null,
                pkgDownloadProgress: 0,
                networkInterfaces: [],
                configFileWatcher: null,
                profileUpdateFailed: {},
                profileUpdateFailedURLs: [],
                shortcuts: {},
                menuKeyboardClickTimes: 0,
                isUserDNSChanged: false,
                isResolvingMixedPortConflict: false,
                isCoreRestarting: false,
                clashMixedPort: -1
            };
        },
        watch: {
            $route(route) {
                if (route.path !== undefined) this.setCurrentRoutePath({ path: route.path });
                if (route.path === "/home/server") this.profileUpdateFailedURLs = [];
            },
            isWindowShow: {
                immediate: true,
                handler(value) { if (value) scheduler.resumeAll(); else scheduler.pauseAll(); }
            },
            async clashMixedPort(value) {
                if (value !== 0) return;
                await this.checkMixedPortConflict();
            },
            mixedPort() {
                logger.info("mixed-port changed");
                this.resetSystemProxySettings();
            },
            controllerPort() { logger.info("external controller port changed"); },
            finalInterfaceName(value) {
                logger.info(`new outbound interface: ${value}`);
                this.refreshProfile();
            },
            async clashStatus(value) {
                logger.info(`clash status change to [${value === connectionStatus.CONNECTED ? getLanguage().connected() : "断开连接"}]`);
                electron.ipcRenderer.send("clash-core-status-change", value === connectionStatus.CONNECTED ? 0 : 1);
                if (value === connectionStatus.CONNECTED) {
                    this.setIsLaunching({ isLaunching: false });
                    await this.refreshProfile().catch(() => {});
                    this.addProfileRefreshTimes({ times: 1 });
                    await this.checkMixedPortConflict();
                }
            },
            clashAxiosClient(client) {
                logger.info("clash axios client changed");
                electron.ipcRenderer.send("clash-core-info", { port: this.controllerPort, secret: this.secret });
                if (!client) return;
                client.interceptors.request.use(config => {
                    this.addClashAxiosFlyingRequestCount({ count: 1 });
                    return config;
                }, error => Promise.reject(error));
                client.interceptors.response.use(response => {
                    this.addClashAxiosFlyingRequestCount({ count: -1 });
                    return response;
                }, error => {
                    this.addClashAxiosFlyingRequestCount({ count: -1 });
                    return Promise.reject(error);
                });
            },
            status: {
                immediate: true,
                handler(value) {
                    this.updateTrayIcon();
                    electron.ipcRenderer.send("system-proxy-changed", value === proxyStatus.SYSTEM_PROXY);
                }
            },
            "settings.hideTrayIcon": {
                immediate: true,
                async handler(value) {
                    await electron.ipcRenderer.invoke("tray-create-destroy", value ? "destroy" : "create");
                    this.updateTrayIcon();
                }
            },
            "settings.trayProxiesStyle": {
                immediate: true,
                async handler(value) { await electron.ipcRenderer.invoke("tray-proxies-style", value || 0); }
            },
            "settings.showTrayProxyDelayIndicator": {
                immediate: true,
                async handler(value) { await electron.ipcRenderer.invoke("tray-proxies-icon", value || false); }
            },
            "settings.useModeIcons"() { this.updateTrayIcon(); },
            "settings.proxyCore"(value) {
                electron.ipcRenderer.send("core-type-changed", value);
                this.rebindScriptModeShortcut(this.settings.shortcutScriptMode, this.settings.shortcutScriptMode);
                if (!supportsScriptMode(value) && this.mode === "script") this.switchMode("rule");
            },
            "settings.iconDefault"() { this.updateTrayIcon(); },
            "settings.iconSystemProxy"() { this.updateTrayIcon(); },
            fontFamily: {
                immediate: true,
                handler(value) { document.body.style.fontFamily = value; }
            },
            "settings.shortcutSystemProxy"(value, previousValue) {
                this.rebindShortcut(value, previousValue, async () => {
                    const enabled = !this.isSystemProxyOn;
                    if (await this.$setSystemProxy(enabled, this.confData)) this.setIsSystemProxyOn({ isOn: enabled });
                });
            },
            "settings.shortcutTun"(value, previousValue) {
                this.rebindShortcut(value, previousValue, async () => {
                    const enabled = !this.isTunEnable;
                    this.chagneIsTunEnable({ isTun: enabled });
                    this.refreshProfile();
                    notify("Shortcut", `TUN Mode: ${enabled ? "On" : "Off"}`);
                });
            },
            "settings.shortcutMixin"(value, previousValue) {
                this.rebindShortcut(value, previousValue, () => {
                    const enabled = !this.isMixinEnable;
                    this.changeIsMixinEnable({ isMixin: enabled });
                    this.refreshProfile();
                    notify("Shortcut", `Mixin: ${enabled ? "On" : "Off"}`);
                });
            },
            "settings.shortcutGlobalMode"(value, previousValue) { this.rebindShortcut(value, previousValue, () => this.switchMode("global")); },
            "settings.shortcutRuleMode"(value, previousValue) { this.rebindShortcut(value, previousValue, () => this.switchMode("rule")); },
            "settings.shortcutDirectMode"(value, previousValue) { this.rebindShortcut(value, previousValue, () => this.switchMode("direct")); },
            "settings.shortcutScriptMode"(value, previousValue) { this.rebindScriptModeShortcut(value, previousValue); },
            "settings.shortcutRunTrayScript"(value, previousValue) { this.rebindShortcut(value, previousValue, this.runTrayScript); },
            "settings.shortcutShowHideDashboard"(value, previousValue) {
                this.rebindShortcut(value, previousValue, () => electron.ipcRenderer.invoke("window-control", "show-or-hide"));
            },
            "settings.systemProxyTypeIndex"() { this.resetSystemProxySettings(); },
            "settings.pacContentText"() { this.resetSystemProxySettings(); },
            "settings.bypassText"() { this.resetSystemProxySettings(); },
            "settings.specifyHttpProxyProtocol"() { this.resetSystemProxySettings(); },
            "settings.staticSystemProxyHost"() { this.resetSystemProxySettings(); },
            "settings.enableDHCPServer"(enabled) {
                if (enabled) {
                    this.setMenuItems({ items: [...this.menuItems, { title: getLanguage().router(), path: "/home/router" }] });
                } else {
                    this.setMenuItems({ items: this.menuItems.filter(item => item.title !== "Router") });
                }
            },
            isMixinEnable(value) {
                this.refreshProfile();
                this.updateTrayIcon();
                electron.ipcRenderer.send("mixin-changed", value);
            },
            "settings.mixinText"() { if (this.isMixinEnable && this.settings.mixinType === 0) this.refreshProfile(); },
            "settings.mixinCode"() { if (this.isMixinEnable && this.settings.mixinType === 1) this.refreshProfile(); },
            "settings.mixinType"() { this.refreshProfile(); },
            "settings.unsafeURLsText": {
                immediate: true,
                handler(value) {
                    let urls = [];
                    try { urls = yaml.parse(value)?.urls || []; } catch (_error) {}
                    electron.ipcRenderer.send("set-allow-unsafe-urls", urls);
                }
            },
            "settings.clashAuthentication"() { this.refreshProfile(); },
            isTunEnable(value) {
                this.updateTrayIcon();
                this.refreshProfile();
                electron.ipcRenderer.send("tun-changed", value);
            },
            tunSettings() { if (this.isTunEnable) this.refreshProfile(); },
            isAppSuspend(value) {
                if (value) return;
                if (this.tun2socks) {
                    logger.info("system resume, restart tun2socks");
                    this.killSpawned(this.tun2socks);
                    this.tun2socks = null;
                    this.spawnTun2socks();
                }
                this.refreshProfile().catch(() => {});
            },
            innerServerPort(value) {
                console.log("inner port:", value);
                this.resetSystemProxySettings();
            },
            mode: {
                immediate: true,
                async handler(value) {
                    this.updateTrayIcon();
                    electron.ipcRenderer.send("mode-changed", value);
                    if (this.settings.connMode) await this.clashApi.closeConnections();
                    const { files = [], index = -1 } = this.profiles;
                    if (index >= 0 && files.length > index) this.changeProfile({ index, profile: { ...files[index], mode: value } });
                }
            }
        },
        computed: {
            ...Vuex.mapState({
                pfs: state => state.app.profiles,
                devMode: state => state.app.isDevMode,
                profiles: state => state.app.profiles,
                clashPath: state => state.app.clashPath,
                clashStatus: state => state.app.clashStatus,
                confData: state => state.app.confData,
                profilesPath: state => state.app.profilesPath,
                isMixinEnable: state => state.app.isMixinEnable,
                isTunEnable: state => state.app.isTunEnable,
                status: state => state.app.status,
                clashAxiosFlyingRequestCount: state => state.app.clashAxiosFlyingRequestCount,
                logFilePath: state => state.app.logFilePath,
                shouldUseDarkTheme: state => state.app.shouldUseDarkTheme,
                detectedInterfaceName: state => state.app.detectedInterfaceName,
                isAppSuspend: state => state.app.isAppSuspend,
                innerServerPort: state => state.app.innerServerPort,
                isLocalMode: state => state.app.isLocalMode,
                isWindowShow: state => state.app.isWindowShow,
                menuItems: state => state.app.menuItems,
                isSystemProxyOn: state => state.app.isSystemProxyOn,
                isSubViewShow: state => state.app.isSubViewShow,
                currentRoutePath: state => state.app.currentRoutePath,
                mode: state => state.app.mode,
                isSilentUpgraded: state => state.app.isSilentUpgraded,
                tunSettings: state => state.app.tunSettings,
                userDNS: state => state.app.userDNS
            }),
            ...Vuex.mapGetters(["resourcesPath", "filesPath", "mixedPort", "controllerPort", "secret", "clashAxiosClient", "clashGotClient", "fontFamily", "clashBinaryPath", "menuItemsWithOrder"]),
            finalInterfaceName() { return this.settings.interfaceName || this.detectedInterfaceName; },
            statusHint() {
                if (this.pkgDownloadProgress > 0 && this.pkgDownloadProgress < 1) return `Download progress: ${(100 * this.pkgDownloadProgress).toFixed(2)}%`;
                if (this.clashStatus === connectionStatus.CONNECTED) return getLanguage().connected();
                if (this.clashStatus === connectionStatus.DISCONNECTED) return getLanguage().disconnected();
                return undefined;
            },
            statusIcon() {
                return {
                    "clash-status-icon": true,
                    "clash-running": this.clashStatus === connectionStatus.CONNECTED,
                    "clash-stopped": this.clashStatus === connectionStatus.DISCONNECTED
                };
            }
        },
        methods: {
            ...Vuex.mapMutations({
                setIsDevMode: "SET_IS_DEV_MODE",
                setConfData: "SET_CONF_DATA",
                changeProfile: "CHANGE_PROFILE",
                changeProfileIndex: "CHANGE_PROFILES_INDEX",
                setClashPath: "SET_CLASH_PATH",
                setClashStatus: "SET_CLASH_STATUS",
                loadProfiles: "LOAD_PROFILES",
                setProfilesPath: "SET_PROFILES_PATH",
                setLogFilePath: "SET_LOG_FILE_PATH",
                changeIsMixinEnable: "CHANGE_IS_MIXIN_ENABLE",
                chagneIsTunEnable: "CHANGE_IS_TUN_ENABLE",
                setExePath: "SET_EXE_PATH",
                appendError: "APPEND_ERROR",
                addClashAxiosFlyingRequestCount: "ADD_AXIOS_FLYING_REQUEST_COUNT",
                setShouldUseDarkTheme: "SET_SHOULD_USE_DARK_THEME",
                setDetectedInterfaceName: "SET_DETECTED_INTERFACE_NAME",
                setIsWindowShow: "SET_IS_WINDOW_SHOW",
                setIsAppSuspend: "SET_IS_APP_SUSPEND",
                setIsLocalMode: "SET_IS_LOCAL_MODE",
                setIsLaunching: "SET_IS_LAUNCHING",
                setMenuItems: "SET_MENU_ITEMS",
                setIsSystemProxyOn: "SET_IS_SYSTEM_PROXY_ON",
                setCurrentRoutePath: "SET_CURRENT_ROUTE_PATH",
                addProfileRefreshTimes: "ADD_PROFILE_REFRESH_TIMES",
                setCurrentProfilePayload: "SET_CURRENT_PROFILE_PAYLOAD",
                setIsSilentUpgraded: "SET_IS_SILENT_UPGRADED",
                setIsFirewallRuleExist: "SET_IS_FIREWALL_RULE_EXIST",
                setUserDNS: "SET_USER_DNS",
                setMatchedSSID: "SET_MATCHED_SSID"
            }),
            ...Vuex.mapActions(["setMode"]),
            async setSSIDOptions() {
                const restoreDefaults = async () => {
                    const mixin = cache.get(keys.IS_MIXIN) || false;
                    const tun = cache.get(keys.IS_TUN) || false;
                    const systemProxy = cache.get(keys.SYSTEM_PROXY) || false;
                    this.changeIsMixinEnable({ isMixin: mixin });
                    this.chagneIsTunEnable({ isTun: tun });
                    if (await this.$setSystemProxy(systemProxy, this.confData)) this.setIsSystemProxyOn({ isOn: systemProxy });
                };
                try {
                    this.setMatchedSSID({ ssid: "" });
                    const connections = getWlanInterfaces() || [];
                    const strategy = yaml.parse(this.settings.ssidStrategyText).strategy;
                    logger.info(JSON.stringify({ conns: connections, ssidStrategy: strategy }, null, 2));
                    const connection = connections.find(item => item.SSID in strategy);
                    if (!connection) {
                        await restoreDefaults();
                        return;
                    }
                    this.setMatchedSSID({ ssid: connection.SSID });
                    const options = strategy[connection.SSID];
                    if (!options) return;
                    if (typeof options.mixin === "boolean") this.changeIsMixinEnable({ isMixin: options.mixin });
                    if (typeof options.tun === "boolean") this.chagneIsTunEnable({ isTun: options.tun });
                    if (typeof options.system === "boolean" && await this.$setSystemProxy(options.system, this.confData)) {
                        this.setIsSystemProxyOn({ isOn: options.system });
                    }
                } catch (error) {
                    logger.error(`failed to set ssid options: ${error}`);
                }
            },
            resetDNS() {
                if (!this.isUserDNSChanged || !isMacOS()) return;
                try {
                    const { isUsingResetDNSServers = false, resetDNSServers = [] } = this.settings;
                    if (isUsingResetDNSServers) setDns(resetDNSServers);
                    else if (this.userDNS !== null) setDns(this.userDNS);
                } catch (error) {
                    logger.info(`failed to reset dns with error: ${error}`);
                }
            },
            async breakConnections(proxyName) {
                const mode = this.settings.connProxy ?? 0;
                if (mode === 1) {
                    const response = await this.clashApi.getConnections();
                    if (response.status !== 200) return;
                    for (const connection of response.data.connections || []) {
                        if (connection.chains.includes(proxyName)) await this.clashApi.closeConnection(connection.id);
                    }
                } else if (mode === 2) {
                    await this.clashApi.closeConnections();
                }
            },
            persistSelectedProxy() {
                return persistSelection({
                    getProfiles: () => this.pfs,
                    clashApi: this.clashApi,
                    changeProfile: payload => this.changeProfile(payload)
                });
            },
            runTrayScript() { this.settings.trayScriptManualRunTime = Date.now(); },
            resetSystemProxySettings: lodash.debounce(async function resetSystemProxy() {
                if (this.isSystemProxyOn) await this.$setSystemProxy(true, this.confData);
            }, 500),
            updateTrayIcon() {
                if (!isWindows()) return;
                const active = [proxyStatus.SYSTEM_PROXY, proxyStatus.IS_TUN, proxyStatus.IS_MIXIN].includes(this.status);
                const icon = this.$getTrayIcon(active, this.mode);
                console.log("updateTrayIcon", icon);
                electron.ipcRenderer.send("status-changed", icon);
            },
            async resolveMixedPortConflict() {
                if (this.isResolvingMixedPortConflict) return;
                this.isResolvingMixedPortConflict = true;
                const labels = getLanguage();
                try {
                    await electron.ipcRenderer.invoke("window-control", "show");
                    while (this.clashMixedPort === 0) {
                        const choice = await showMessageBox({
                            type: "warning",
                            title: labels.changeMixedPort(),
                            message: labels.mixedPortUnavailable(),
                            detail: labels.mixedPortRecoveryDescribe(),
                            buttons: [labels.newPort(), labels.randomMixedPort(), labels.cancel()],
                            defaultId: 1,
                            cancelId: 2
                        });
                        if (!choice || choice.response === 2) return;

                        let port = null;
                        const manual = choice.response === 0;
                        if (manual) {
                            const result = await this.$input({
                                title: labels.changeMixedPort(),
                                data: [{
                                    name: labels.newPort(), key: "port", placeholder: this.mixedPort || 7890, value: "",
                                    validate: value => parsePort(value) !== null ? "" : labels.invalidPort()
                                }],
                                hint: labels.mixedPortRecoveryDescribe()
                            }).catch(() => null);
                            if (!result) return;
                            port = parsePort(result.port);
                            if (port === null || !(await isTcpPortAvailable({ net, port }))) {
                                await showMessageBox({
                                    type: "error",
                                    title: labels.changeMixedPort(),
                                    message: labels.portUnavailable(),
                                    buttons: [labels.ok()]
                                });
                                continue;
                            }
                            if (!(await applyAndVerifyMixedPort({ clashApi: this.clashApi, port, sleep }))) {
                                await showMessageBox({
                                    type: "error",
                                    title: labels.changeMixedPort(),
                                    message: labels.portUnavailable(),
                                    buttons: [labels.ok()]
                                });
                                continue;
                            }
                        } else {
                            try {
                                port = await recoverWithRandomPort({
                                    getPort, net, clashApi: this.clashApi, sleep
                                });
                            } catch (_error) {
                                await showMessageBox({
                                    type: "error",
                                    title: labels.changeMixedPort(),
                                    message: labels.noAvailablePort(),
                                    buttons: [labels.ok()]
                                });
                                continue;
                            }
                        }

                        await updateYaml(path.join(this.clashPath, "config.yaml"), "mixed-port", port);
                        if (manual) this.settings.randomMixedPort = false;
                        this.setConfData({ data: { ...this.confData, "mixed-port": port } });
                        this.clashMixedPort = port;
                        notify(labels.port(), `${port}`, { silent: true });
                        return;
                    }
                } finally {
                    this.isResolvingMixedPortConflict = false;
                }
            },
            async checkMixedPortConflict() {
                if (this.isCoreRestarting || this.isResolvingMixedPortConflict
                    || this.clashStatus !== connectionStatus.CONNECTED || this.clashMixedPort !== 0) {
                    return false;
                }
                const confirmed = await confirmMixedPortConflict({
                    clashApi: this.clashApi,
                    sleep
                });
                if (!confirmed || this.isCoreRestarting
                    || this.clashStatus !== connectionStatus.CONNECTED || this.clashMixedPort !== 0) {
                    return false;
                }
                await this.resolveMixedPortConflict();
                return true;
            },
            setFont(value) {
                document.body.style.fontFamily = value || '"Microsoft Yahei", "PingFang SC", "system-ui", 微软雅黑, "TwemojiMozilla"';
            },
            refreshProfile() {
                const labels = getLanguage();
                return refreshRendererProfile(this, {
                    fs,
                    path,
                    yaml,
                    platform: runtimeProcess.platform,
                    childProcess: dependencies.childProcess,
                    compileMixin: dependencies.requireFromString,
                    hash,
                    setDns,
                    getPort,
                    onDisconnectCleanupError: () => logger.warn("Could not close all existing connections after disabling the proxy"),
                    mixinHelpers: {
                        axios: httpClient,
                        yaml,
                        notify: (title, body = "", silent = true) => notify(title, body, { silent })
                    },
                    messages: {
                        tunInterface: labels.tunModeEnableButIssue(),
                        tapInterface: labels.modeTAPEnableNoINthisYAML(),
                        providers: labels.providers()
                    }
                });
            },
            async switchMode(mode) { await this.setMode({ mode }); },
            showLogsFolder(openFolder = false) {
                if (!this.clashPath || !/\.log$/.test(this.logFilePath)) return;
                if (openFolder) electron.shell.openPath(path.join(this.logFilePath, ".."));
                else electron.shell.showItemInFolder(this.logFilePath);
            },
            open(url) { electron.shell.openExternal(url); },
            createClashCoreRuntime() {
                return createClashCoreRuntime({
                    childProcess: dependencies.childProcess,
                    fs,
                    path,
                    serviceApi: createClashServiceApi({ client: httpClient }),
                    logger
                });
            },
            async killClashCore() {
                await this.createClashCoreRuntime().stop({
                    processHandle: this.clash,
                    lightweightMode: cache.get(keys.IS_LIGHTWEIGHT_MODE_CLOSE) || false,
                    platform: runtimeProcess.platform
                });
                this.clash = null;
            },
            async handlerRestartClash() {
                this.isCoreRestarting = true;
                try {
                    await this.killClashCore().catch(() => {});
                    this.setClashStatus({ status: connectionStatus.DISCONNECTED });
                    this.shwoError = false;
                    await this.spawnClash().catch(() => {});
                } finally {
                    this.isCoreRestarting = false;
                }
            },
            async spawnClash() {
                const result = await this.createClashCoreRuntime().start({
                    clashPath: this.clashPath,
                    binaryPath: this.clashBinaryPath,
                    coreType: this.settings.proxyCore,
                    logLevel: this.confData["log-level"],
                    isLocalMode: this.isLocalMode,
                    portableMode: this.portableMode,
                    devMode: this.devMode,
                    lightweightMode: cache.get(keys.IS_LIGHTWEIGHT_MODE_CLOSE) || false,
                    clashApi: this.clashApi,
                    startupErrorMessage: getLanguage().clashCoreFailedStartup(),
                    onLogFile: logPath => this.setLogFilePath({ path: logPath }),
                    onCoreReady: async () => this.setClashStatus({ status: await this.getClashStatus() }),
                    onServiceFallback: async () => {
                        this.setIsLocalMode({ isLocal: true });
                        await this.spawnClash();
                    }
                });
                if (result.processHandle) {
                    this.clash = result.processHandle;
                    cache.put(keys.LAST_CLASH_PID, result.processHandle.pid);
                }
            },
            createTunRuntime() {
                return createTunRuntime({
                    childProcess: dependencies.childProcess,
                    sudoExec: sudoPrompt.exec,
                    path,
                    platform: runtimeProcess.platform,
                    arch: runtimeProcess.arch,
                    filesPath: this.filesPath,
                    tapInfo: cache.get(keys.TAP_INFO),
                    logger,
                    sleep
                });
            },
            sudoRunBAT(command, callback = null) { return this.createTunRuntime().sudoRun(command, callback); },
            setupTapDevice(install = true) { return this.createTunRuntime().setupTapDevice(install); },
            async spawnTun2socks() {
                const previousProcess = this.tun2socks;
                this.tun2socks = null;
                this.tun2socks = await this.createTunRuntime().spawnTun2socks({ currentProcess: previousProcess, mixedPort: this.mixedPort });
            },
            killSpawned(processHandle) { return this.createTunRuntime().killSpawned(processHandle); },
            setRoutes() { return this.createTunRuntime().setRoutes(); },
            async getClashStatus() {
                const result = await this.createClashCoreRuntime().getStatus(this.clashApi);
                this.clashMixedPort = result.mixedPort;
                return result.connected ? connectionStatus.CONNECTED : connectionStatus.DISCONNECTED;
            },
            async checkForUpdate() {
                if (this.isSilentUpgraded) {
                    logger.info("silent upgrade done, stop checking");
                    return;
                }
                const currentVersion = await electron.ipcRenderer.invoke("app", "getVersion");
                logger.info(`check for app update, current: ${currentVersion}`);
                const response = await httpClient.get("https://raw.githubusercontent.com/Z-Siqi/Clash-for-Windows_Chinese/main/update");
                if (response.status !== 200) return;
                const version = response.data.tag_name;
                const versionNumber = value => value.split(".").reverse().reduce((total, part, index) => total + Number(part) * (1000 ** index), 0);
                if (versionNumber(version) <= versionNumber(currentVersion)) return;

                const assets = { portable: {}, installer: {}, diskImage: {}, linux: {} };
                for (const asset of response.data.assets) {
                    const name = asset.name;
                    if (!name) continue;
                    if (/\d+\.\d+\.\d+(?:-Opt\.\d+)?-win\.7z/.test(name)) assets.portable[updateTargets.windowsX64] = asset;
                    else if (/\d+\.\d+\.\d+(?:-Opt\.\d+)?-ia32-win\.7z/.test(name)) assets.portable[updateTargets.windowsIa32] = asset;
                    else if (/\d+\.\d+\.\d+(?:-Opt\.\d+)?-arm64-win\.7z/.test(name)) assets.portable[updateTargets.windowsArm64] = asset;
                    else if (/\d+\.\d+\.\d+(?:-Opt\.\d+)?-arm64-mac\.7z/.test(name)) assets.portable[updateTargets.macArm64] = asset;
                    else if (/\d+\.\d+\.\d+(?:-Opt\.\d+)?-mac\.7z/.test(name)) assets.portable[updateTargets.macX64] = asset;
                    else if (/\d+\.\d+\.\d+(?:-Opt\.\d+)?[-\.]ia32\.exe/.test(name)) assets.installer[updateTargets.windowsIa32] = asset;
                    else if (/\d+\.\d+\.\d+(?:-Opt\.\d+)?\.arm64\.exe/.test(name)) assets.installer[updateTargets.windowsArm64] = asset;
                    else if (/\d+\.\d+\.\d+(?:-Opt\.\d+)?\.exe/.test(name)) assets.installer[updateTargets.windowsX64] = asset;
                    else if (/arm64\.dmg/.test(name)) assets.diskImage[updateTargets.macArm64] = asset;
                    else if (/\.dmg/.test(name)) assets.diskImage[updateTargets.macX64] = asset;
                    else if (/x64\-linux\.tar\.gz/.test(name)) assets.linux[updateTargets.linuxX64] = asset;
                }
                const assetUrl = category => assets[category]?.[currentTarget()]?.browser_download_url;
                let downloadUrl;
                if (this.portableMode) downloadUrl = assetUrl("portable");
                else if (isMacOS()) downloadUrl = assetUrl("diskImage");
                else if (isWindows()) downloadUrl = assetUrl("installer");
                else if (isLinux()) downloadUrl = assetUrl("linux");
                const releasePage = `https://github.com/Z-Siqi/Clash-for-Windows_Chinese/releases/tag/${encodeURIComponent(version)}`;
                this.newVersionInfo = {
                    version,
                    log: String(response.data.body || ""),
                    url: downloadUrl || "https://github.com/Z-Siqi/Clash-for-Windows_Chinese/releases",
                    releasePage,
                    isPortable: this.portableMode,
                    reactions: response.data?.reactions || null,
                    reactionClick: () => electron.shell.openExternal(releasePage)
                };
            },
            createConfigurationRuntime() {
                return createRendererConfiguration(this, {
                    fs,
                    path,
                    yaml,
                    uuid: uuid.v4,
                    platform: runtimeProcess.platform,
                    arch: runtimeProcess.arch,
                    shouldReplaceWintun,
                    getPort
                });
            },
            loadConfData() { return this.createConfigurationRuntime().load(); },
            initConfigFolder() { return this.createConfigurationRuntime().initialize(); },
            initProfilesFolder() { return this.createConfigurationRuntime().initializeProfiles(); },
            startChild(processConfig) {
                if (!processConfig || !Object.prototype.hasOwnProperty.call(processConfig, "command")) return null;
                return dependencies.childProcess.spawn(processConfig.command, processConfig.args || [], {
                    ...(processConfig.options || {}),
                    windowsHide: true
                });
            },
            spawnUserDefindExes() {
                if (!this.confData) return;
                let processes = [];
                try { processes = yaml.parse(this.settings.childProcessText || "").processes || []; } catch (_error) {}
                const processIds = [];
                for (const processConfig of processes) {
                    const { log, options = {} } = processConfig;
                    const processHandle = this.startChild(processConfig);
                    if (!processHandle) continue;
                    if (log && options.cwd) {
                        processHandle.stderr?.pipe(fs.createWriteStream(path.join(options.cwd, "cfw-child-process-err.log"), { flags: "a" }));
                        processHandle.stdout?.pipe(fs.createWriteStream(path.join(options.cwd, "cfw-child-process-out.log"), { flags: "a" }));
                    }
                    processIds.push(processHandle.pid);
                }
                cache.put(keys.LAST_USER_EXE_PIDS, processIds);
            },
            async preDownloadAds() {
                const response = await httpClient.get(runtimeState.adImages + Date.now());
                if (response.status === 200 && response.data.feedback) cache.put(keys.AD_IMAGES, response.data.feedback);
            },
            async profileUpdater() {
                if (!this.profiles || this.isAppSuspend) return;
                const now = () => Date.now();
                const profilesToUpdate = (this.profiles.files || []).filter(profile => {
                    const { interval, url, time, cron: cronExpression = "" } = profile;
                    if (!url) return false;
                    try {
                        const currentTime = moment();
                        if (cronExpression && new cron(cronExpression).isMatchDate(currentTime)) return true;
                        if (interval > 0) {
                            const modifiedAt = fs.statSync(path.join(this.profilesPath, time)).mtime;
                            if (!modifiedAt) return false;
                            const failedAt = this.profileUpdateFailed[url];
                            if (failedAt !== undefined) {
                                if (!moment(failedAt).add(interval, "hours").isBefore(currentTime)) return false;
                                delete this.profileUpdateFailed[url];
                            }
                            return moment(modifiedAt).add(interval, "hours").isBefore(currentTime);
                        }
                    } catch (_error) {}
                    return false;
                });
                const results = await Promise.allSettled(profilesToUpdate.map(profile => downloadProfile({
                    url: profile.url,
                    headersString: profile.headers
                })));
                for (let index = 0; index < results.length; index++) {
                    if (results[index].status !== "fulfilled") continue;
                    const { success, message, targetIndex } = results[index].value;
                    const url = profilesToUpdate[index].url;
                    if (success && targetIndex === this.profiles.index) await this.refreshProfile();
                    if (success && this.profileUpdateFailedURLs.includes(url)) {
                        this.profileUpdateFailedURLs = this.profileUpdateFailedURLs.filter(item => item !== url);
                    }
                    if (message) {
                        logger.warn(`${getLanguage().failUpdateUrlProfile()}${url}`);
                        notify(getLanguage().profileUpdateFail(), url);
                        if (!Object.prototype.hasOwnProperty.call(this.profileUpdateFailed, url)) this.profileUpdateFailed[url] = now();
                        if (!this.profileUpdateFailedURLs.includes(url)) this.profileUpdateFailedURLs = [...this.profileUpdateFailedURLs, url];
                    }
                }
                const activeFiles = (this.profiles.files || []).map(profile => profile.time);
                fs.readdir(this.profilesPath, (error, files) => {
                    if (error || files.length === 0) return;
                    files.forEach(file => {
                        if (!/^\d+\.yml$/.test(file) || activeFiles.includes(file)) return;
                        const modifiedAt = fs.statSync(path.join(this.profilesPath, file)).mtimeMs;
                        if (modifiedAt && moment(modifiedAt).isBefore(moment().subtract(1, "month"))) fs.unlinkSync(path.join(this.profilesPath, file));
                    });
                });
            },
            async rebindShortcut(shortcut, previousShortcut, callback) {
                if (previousShortcut) {
                    try {
                        await electron.ipcRenderer.invoke("globalShortcut", "unregister", previousShortcut);
                        delete this.shortcuts[previousShortcut];
                    } catch (_error) {}
                }
                if (!shortcut) return false;
                try {
                    await electron.ipcRenderer.invoke("globalShortcut", "register", shortcut);
                    const registered = await electron.ipcRenderer.invoke("globalShortcut", "isRegistered", shortcut);
                    if (registered) this.shortcuts[shortcut] = callback;
                    return registered;
                } catch (error) {
                    console.error(error);
                    return false;
                }
            },
            rebindScriptModeShortcut(shortcut, previousShortcut) {
                return this.rebindShortcut(
                    supportsScriptMode(this.settings.proxyCore) ? shortcut : "",
                    previousShortcut,
                    () => this.switchMode("script")
                );
            },
            detectInterfaceName() {
                const interfaceName = detectInterface();
                if (interfaceName && interfaceName !== this.detectedInterfaceName) this.setDetectedInterfaceName({ interfaceName });
            },
            async quit() {
                logger.info(getLanguage().appExiting());
                await this.killClashCore();
                this.resetDNS();
                try {
                    if (this.isSystemProxyOn) await this.$setSystemProxy(false);
                } finally {
                    electron.ipcRenderer.send("cleanup-done");
                }
            }
        },
        mounted() {
            window.addEventListener("online", () => {
                logger.info("network online");
                this.detectInterfaceName();
                this.refreshProfile();
            });
            electron.ipcRenderer.on("wlan-status-changed", lodash.debounce((_event, payload) => {
                if ([
                    "ssidDidChangeForWiFiInterfaceWithName",
                    "wlan_notification_acm_connection_complete",
                    "network_interfaces_changed"
                ].includes(payload?.code)) {
                    logger.info(`wlan-status-changed: ${JSON.stringify(payload)}`);
                    this.setSSIDOptions();
                }
            }, 200));
            electron.ipcRenderer.on("wlan-status-listen-error", (_event, error) => {
                logger.error(`failed to listen network change nativly: ${error}`);
                window.addEventListener("online", () => this.setSSIDOptions());
            });
            electron.ipcRenderer.invoke("wlan-status-wanted");
        },
        async beforeMount() {
            const visible = await electron.ipcRenderer.invoke("window", "isVisible");
            this.setIsWindowShow({ isShow: visible });
            this.startTime = Date.now();
            const packaged = await electron.ipcRenderer.invoke("app", "isPackaged");
            this.setIsDevMode({ isDevMode: !packaged });
            logger.info(`${getLanguage().appStartWithMode()}${this.devMode ? "dev" : "production"}`);
            this.$router.replace({ path: this.currentRoutePath }).catch(() => {});

            const executablePath = this.devMode ? "" : await electron.ipcRenderer.invoke("app", "getPath", "exe");
            this.setExePath({ path: executablePath });
            const previousCorePid = cache.get(keys.LAST_CLASH_PID);
            if (previousCorePid) this.killSpawned({ pid: previousCorePid });
            for (const processId of cache.get(keys.LAST_USER_EXE_PIDS) || []) this.killSpawned({ pid: processId });

            this.setShouldUseDarkTheme({
                shouldUseDarkTheme: await electron.ipcRenderer.invoke("nativeTheme", "shouldUseDarkColors")
            });
            electron.ipcRenderer.on("native-theme-updated", (_event, shouldUseDarkTheme) => {
                this.setShouldUseDarkTheme({ shouldUseDarkTheme });
            });
            electron.ipcRenderer.on("shortcut-pressed", async (_event, shortcut) => {
                const handler = this.shortcuts[shortcut];
                if (handler) await handler();
            });
            electron.ipcRenderer.send("clash-core-status-change", 0);
            electron.ipcRenderer.on("break-connections", (_event, proxyName) => this.breakConnections(proxyName));
            electron.ipcRenderer.on("persist-selected-proxy", () => this.persistSelectedProxy());
            electron.ipcRenderer.on("app-exit", this.quit);
            electron.ipcRenderer.on("power-event", (_event, name) => this.setIsAppSuspend({ isSuspend: name === "suspend" }));
            electron.ipcRenderer.on("system-proxy-changed", async (_event, enabled) => {
                if (await this.$setSystemProxy(enabled, this.confData)) this.setIsSystemProxyOn({ isOn: enabled });
            });
            electron.ipcRenderer.send("mixin-changed", this.isMixinEnable);
            electron.ipcRenderer.on("mixin-changed", (_event, enabled) => {
                this.changeIsMixinEnable({ isMixin: enabled });
                this.refreshProfile();
            });
            electron.ipcRenderer.send("tun-changed", this.isTunEnable);
            electron.ipcRenderer.on("tun-changed", (_event, enabled) => {
                this.chagneIsTunEnable({ isTun: enabled });
                this.refreshProfile();
            });
            electron.ipcRenderer.on("run-tray-script", this.runTrayScript);
            electron.ipcRenderer.on("mode-changed", (_event, mode) => this.switchMode(mode));
            electron.ipcRenderer.on("app-open", async (_event, argumentsList) => {
                const installArgument = argumentsList.find(argument => /clash:\/\/install-config\/?\?url=(.+?)(?=$|&)/.test(argument));
                if (installArgument) {
                    const url = decodeURIComponent(RegExp.$1.trim());
                    if (/^https?:\/\//.test(url)) {
                        const result = await downloadProfile({ url });
                        notify("Profile", result.success ? getLanguage().profileDownloaded() : result.message);
                        if (result.success) {
                            this.changeProfileIndex({ index: result.targetIndex });
                            this.refreshProfile();
                        }
                    }
                }
                if (argumentsList.some(argument => /clash:\/\/quit/.test(argument))) await this.quit();
            });
            electron.ipcRenderer.on("menu-item-change", (_event, item) => {
                this.$router.replace({ path: `/home/${item}` });
            });
            electron.ipcRenderer.on("window-event", (_event, name) => {
                if (["show", "hide"].includes(name)) this.setIsWindowShow({ isShow: name === "show" });
                else if (name === "close" && this.settings.lightweightMode && !this.isLocalMode) {
                    cache.put(keys.IS_LIGHTWEIGHT_MODE_CLOSE, true);
                    electron.ipcRenderer.send("cleanup-done");
                }
            });

            const homePath = await electron.ipcRenderer.invoke("app", "getPath", "home");
            const portableDataPath = path.join(executablePath, "../data");
            let clashPath = path.join(homePath, "/.config/clash");
            if (fs.existsSync(portableDataPath)) {
                clashPath = portableDataPath;
                this.portableMode = true;
            }
            this.userPath = homePath;
            this.setClashPath({ path: clashPath });
            await this.initConfigFolder();
            this.loadConfData();
            if (isMacOS()) {
                getDns().then(dns => this.setUserDNS({ dns })).catch(error => logger.info(`faile to get user dns setting with error: ${error}`));
            }
            this.loadSettings();
            electron.ipcRenderer.send("core-type-changed", this.settings.proxyCore);
            if (isWindows()) {
                try {
                    await startPacServer({ store, validatePort, getPort, Koa, defaultPac });
                    logger.info(`${getLanguage().httpStartAt()}${this.innerServerPort}`);
                } catch (error) {
                    logger.info(`${getLanguage().httpFailStart()}${error}`);
                }
            }

            const lightweightMode = cache.get(keys.IS_LIGHTWEIGHT_MODE_CLOSE) || false;
            const { hideTrayIcon, hideAfterStartup, profilePath } = this.settings;
            if (hideTrayIcon || lightweightMode || !hideAfterStartup) electron.ipcRenderer.invoke("window-control", "show");
            this.setProfilesPath({ path: profilePath || path.join(this.clashPath, "profiles") });
            this.initProfilesFolder();
            this.loadProfiles();
            if (!this.devMode && !lightweightMode) {
                try { await this.createConfigurationRuntime().randomizePorts(lightweightMode); } catch (_error) {}
            }
            const status = await serviceStatus();
            this.setIsLocalMode({ isLocal: status !== serviceActiveStatus });

            let disconnectedChecks = 0;
            const pollCoreStatus = async () => {
                if ((this.clashStatus !== connectionStatus.CONNECTED || this.isWindowShow)
                    && this.clashAxiosFlyingRequestCount < 5) {
                    const currentStatus = await this.getClashStatus();
                    if (currentStatus === connectionStatus.CONNECTED) disconnectedChecks = 0;
                    else if (currentStatus === connectionStatus.DISCONNECTED) disconnectedChecks++;
                    if (disconnectedChecks >= (currentStatus === connectionStatus.CONNECTED ? 0 : 5)) {
                        disconnectedChecks = 0;
                        this.setClashStatus({ status: currentStatus });
                    }
                }
            };
            pollCoreStatus();
            Array.from({ length: 5 }).forEach((_unused, index) => setTimeout(pollCoreStatus, 500 + 500 * index));
            setInterval(pollCoreStatus, 3000);
            await this.handlerRestartClash();

            if (runtimeState.languageInProfile !== -1 && runtimeState.languageInProfile !== cache.get(languageKey)) {
                cache.put(languageKey, runtimeState.languageInProfile);
                electron.ipcRenderer.invoke("window", "reload");
            }
            if (!this.settings.disableLoadingAdsLink) {
                runtimeState.adImages = "https://raw.githubusercontent.com/Fndroid/ads/master/ads_v2.json?t=";
            } else if (cache.get(keys.AD_IMAGES) !== null && cache.get(keys.AD_IMAGES) !== "") {
                cache.put(keys.AD_IMAGES, "");
            }
            cache.put(keys.IS_LIGHTWEIGHT_MODE_CLOSE, false);
            if (!this.showStartup) {
                this.showStartup = true;
                if (isWindows() && os.release().startsWith("6.")) {
                    notify("Attention", "The support for Windows 7 will be dropped soon in 2023 due to upstream changes. Click to learn more.", { hideWindowOnClick: true }, () => {
                        electron.shell.openExternal("https://cloud.google.com/blog/products/chrome-enterprise/extending-chrome-on-windows-7-to-support-enterprise-customers");
                    });
                } else {
                    notify(getLanguage().cfwRunInBg(), getLanguage().enjoyFreedom());
                }
            }
            this.detectInterfaceName();
            this.setSSIDOptions();
            this.spawnUserDefindExes();
            if (this.settings.checkForUpdates) this.checkForUpdate().catch(console.error);
            setInterval(() => { if (this.settings.checkForUpdates) this.checkForUpdate().catch(console.error); }, 21600000);
            this.preDownloadAds().catch(console.error);
            setInterval(this.profileUpdater, 60000);
            this.profileUpdater();
            if (isWindows()) this.setIsFirewallRuleExist({ isExist: await firewallRuleExists() });

            mousetrap.bind(["command+f12", "ctrl+f12"], () => {
                electron.ipcRenderer.invoke("webContent", "toggleDevTools");
                return false;
            });
            mousetrap.bind(["command+w", "ctrl+w"], event => {
                if (shouldCloseWindowForShortcut(event)) {
                    electron.ipcRenderer.invoke("window", "close");
                    return false;
                }
                return undefined;
            });
            mousetrap.bind("esc", event => {
                if (shouldCloseWindowForShortcut(event)) {
                    electron.ipcRenderer.invoke("window", "close");
                    return false;
                }
                return undefined;
            }, "keydown");
            const navigateToMenu = position => {
                const index = position - 1;
                if (index >= 0 && index < this.menuItemsWithOrder.length) {
                    this.$router.replace({ path: this.menuItemsWithOrder[index].path }).catch(() => {});
                }
            };
            for (let position = 1; position <= 9; position++) {
                mousetrap.bind(`${position}`, () => {
                    this.menuKeyboardClickTimes++;
                    navigateToMenu(position);
                    return false;
                });
            }
        }
    };
}

module.exports = { configureLogger, createMacDnsHelpers, startPacServer, createHomePageOptions };
