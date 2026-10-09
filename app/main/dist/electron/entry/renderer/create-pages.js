"use strict";

const asyncToGenerator = require("@babel/runtime/helpers/asyncToGenerator");
const defineProperty = require("@babel/runtime/helpers/defineProperty");
const slicedToArray = require("@babel/runtime/helpers/slicedToArray");
const toConsumableArray = require("@babel/runtime/helpers/toConsumableArray");
const regenerator = require("@babel/runtime/regenerator");
const qrcode = require("qrcode");
const draggable = require("vuedraggable");

const { createClashApi } = require("../../core/network/clash-api");
const { connectionStatus, proxyStatus } = require("../../features/application-state/status");
const { normalizeConnectionsSnapshot, normalizeStructuredLog, parseCoreLogLine } = require("../../features/clash-core/core-api-compat");
const { createGeneralPage } = require("../../features/clash-core/general-page");
const { createGeneralPageWorkflow } = require("../../features/clash-core/general-page-workflow");
const { createConnectionsPage } = require("../../features/connections/page");
const { renderConnectionDisconnectSettings } = require("../../features/connections/settings-view");
const { createFeedbackPage } = require("../../features/feedback/page");
const { createHomePage } = require("../../features/home/page");
const { createLogsPage } = require("../../features/logs/page");
const { ensureMixinDefaults, validateMixinSettings } = require("../../features/mixin/mixin-runtime");
const { createProfileEditor } = require("../../features/profiles/profile-editor-page");
const { buildProxyConfig } = require("../../features/profiles/proxy-editor-config");
const { createRuleEditor } = require("../../features/profiles/rule-editor-page");
const { createServerPage } = require("../../features/profiles/server-page");
const { createServerPageWorkflow } = require("../../features/profiles/server-page-workflow");
const { createProvidersPage } = require("../../features/providers/page");
const { createProxiesPage } = require("../../features/proxies/page");
const { defineComponent } = require("../../features/renderer-ui/component");
const { createRouterPage } = require("../../features/router/page");
const { createSettingsPage } = require("../../features/settings/page");
const { createRendererConfiguration } = require("./configuration");
const { refreshProfile } = require("./refresh-profile");
const { persistSelection } = require("../../features/profiles/persist-selection");

function createRendererPages({ Vuex, modifyState, runtime, components, version }) {
    const language = runtime.getLanguage;
    const languageIndex = () => modifyState.language;
    const {
        axios, cache, cron, defaultBypass, defaultPac, electron, firewall,
        fs, getPort, getDefaultInterface, getNetworkInterfaces, getWlanInterfaces,
        keys, lodash, logger, moment, mousetrap, net, path, platform,
        profileParser, runMacSystemProxyCommand, scheduler,
        scripts, serviceModule, store, utilities,
        uuid, yaml
    } = runtime;

    const home = createHomePage({
        defineComponent, Vuex, lodash, draggable, cache,
        connectionStatus, proxyStatus, runtimeProcess: runtime.processObject, electron,
        path, fs, moment, scheduler,
        keys, Hint: components.Hint, logger,
        httpClient: axios, yaml,
        publicContent: runtime.publicContent,
        validatePort: utilities.isPortInRange, notify: utilities.notify,
        showMessageBox: utilities.showMessageBox, updateYaml: utilities.updateYaml,
        hash: utilities.hashText,
        sleep: utilities.delay, shouldReplaceWintun: utilities.isNewVersion,
        detectInterface: getDefaultInterface, store, defaultPac, getPort,
        checkPort: runtime.checkPort,
        openCoreLog: runtime.openCoreLog,
        startPacServer: async home => store.commit("SET_INNER_SERVER_PORT", { port: await runtime.coreConfigRepository.startPac(home) }),
        downloadProfile: profileParser.downloadProfile, net,
        runMacCommand: runMacSystemProxyCommand, uuid,
        firewallRuleExists: firewall.status, getWlanInterfaces,
        mousetrap, cron, serviceStatus: serviceModule.statusService,
        serviceActiveStatus: serviceModule.status.Active,
        runtimeState: modifyState, getLanguage: language,
        refreshRendererProfile: (vm, dependencies) => refreshProfile(vm, {
            ...dependencies, onProfileApplied: () => store.commit("ADD_PROFILE_REFRESH_TIMES", { times: 1 })
        }),
        profileNetworkEffects: runtime.profileNetworkEffects,
        runMixin: runtime.runMixin,
        runTrayScript: runtime.runTrayScript,
        startUserProcesses: runtime.startUserProcesses,
        profileFiles: runtime.profilesRepository,
        createRendererConfiguration: (vm, dependencies) => createRendererConfiguration(vm, {
            ...dependencies, profilesRepository: runtime.profilesRepository, coreConfigRepository: runtime.coreConfigRepository
        }),
        persistSelection, createTunRuntime: () => runtime.tun,
        createClashCoreRuntime: () => runtime.coreLifecycle,
        isMacOS: platform.isMacOS, isWindows: platform.isWindows,
        isLinux: platform.isLinux, currentTarget: platform.assetTarget,
        updateTargets: {
            windowsX64: platform.windowsX64,
            windowsArm64: platform.windowsArm64,
            macArm64: platform.macArm64,
            macX64: platform.macX64,
            linuxX64: platform.linuxX64
        }
    });

    const generalWorkflow = createGeneralPageWorkflow({
        getLanguage: language, path, moment, yaml, electron, cache, keys,
        getNetworkInterfaces,
        terminal: runtime.terminal,
        coreConfigRepository: runtime.coreConfigRepository,
        platform: {
            isMacOS: platform.isMacOS,
            isWindows: platform.isWindows,
            isLinux: platform.isLinux
        },
        connectedStatus: connectionStatus.CONNECTED,
        service: {
            needUpdate: serviceModule.needUpdate,
            update: serviceModule.updateService,
            install: serviceModule.installService,
            uninstall: serviceModule.uninstallService
        },
        firewall: {
            remove: firewall.remove,
            add: firewall.add,
            status: firewall.status
        },
        utilities: {
            updateYaml: utilities.updateYaml,
            showMessageBox: utilities.showMessageBox,
            notify: utilities.notify
        },
        ensureMixinDefaults,
        validateMixinSettings: (settings, helpers) => Number(settings.mixinType) === 1
            ? runtime.validateMixinCode(settings.mixinCode) : validateMixinSettings(settings, helpers)
    });
    const general = createGeneralPage({
        defineComponent, Vuex, getLanguage: language, version, workflow: generalWorkflow,
        components, shell: electron.shell, fs, yaml, readCoreLog: runtime.readCoreLog,
        platform: { isMacOS: platform.isMacOS, isWindows: platform.isWindows },
        utilities: {
            buildTunConfig: utilities.buildTunConfig,
            showMessageBox: utilities.showMessageBox
        },
        scheduler,
        getNetworkAddresses: runtime.getNetworkAddresses
    });

    const logs = createLogsPage({
        defineComponent, Vuex, getLanguage: language, moment,
        flattenValues: utilities.flattenValues, notify: utilities.notify,
        uniqueId: lodash.uniqueId, connectedStatus: connectionStatus.CONNECTED,
        clipboard: electron.clipboard, readCoreLog: runtime.readCoreLog, cache, keys,
        SelectView: components.SelectView, normalizeStructuredLog, parseCoreLogLine
    });
    const provider = createProvidersPage({
        defineComponent, Vuex, getLanguage: language, moment,
        connectedStatus: connectionStatus.CONNECTED, providerFiles: runtime.providerFiles,
        onProxyProviderUpdated: () => store.commit("ADD_PROXY_REFRESH_TIMES", { times: 1 }),
        Hint: components.Hint
    });
    const proxy = createProxiesPage({
        defineComponent, Hint: components.Hint, Vuex,
        Navigator: components.Navigator, CancelToken: axios.CancelToken,
        cache, keys, lodash, runUserScript: scripts.run,
        cloneJson: utilities.cloneJson, proxyScriptType: scripts.proxyScriptType,
        connectedStatus: connectionStatus.CONNECTED,
        scheduler, getLanguage: language
    });
    const router = createRouterPage({
        defineComponent, Vuex, getLanguage: language, cache, keys,
        getNetworkInterfaces, dhcpService: runtime.dhcpService
    });

    const ProfileEditor = createProfileEditor({
        defineComponent, Vuex, getLanguage: language, buildProxyConfig,
        fs, path, yaml, draggable, profileFiles: runtime.profilesRepository
    });
    const RuleEditor = createRuleEditor({
        defineComponent, Vuex, getLanguage: language, moment, yaml, fs, path, lodash,
        profileFiles: runtime.profilesRepository,
        notify: utilities.notify, cloneJson: utilities.cloneJson
    });
    const serverWorkflow = createServerPageWorkflow({
        profileFiles: runtime.profilesRepository,
        labels: language(), getLanguage: language, moment, yaml, fs, path, electron, lodash,
        CancelToken: axios.CancelToken, downloadProfile: profileParser.downloadProfile,
        runUserScript: scripts.run, profileScriptType: scripts.profileScriptType, scheduler,
        confirmOpenExternal: utilities.confirmOpenExternal, cloneJson: utilities.cloneJson,
        showMessageBox: utilities.showMessageBox, formatBytes: utilities.formatBytes
    });
    const server = createServerPage({
        defineComponent, Vuex, getLanguage: language, getLanguageIndex: languageIndex,
        workflow: serverWorkflow, draggable, ProfileEditor, RuleEditor,
        Hint: components.Hint, qrcode, shortenText: utilities.shortenText,
        confirmOpenExternal: utilities.confirmOpenExternal
    });

    const connection = createConnectionsPage({
        defineComponent, asyncToGenerator, toConsumableArray, defineProperty, regenerator,
        Hint: components.Hint, cache, keys, moment, Vuex,
        connectedStatus: connectionStatus.CONNECTED, path,
        EscCapture: components.EscCapture, formatBytes: utilities.formatBytes,
        flattenValues: utilities.flattenValues, notify: utilities.notify,
        clipboard: electron.clipboard, getLanguage: language,
        getLanguageIndex: languageIndex, normalizeConnectionsSnapshot
    });
    const setting = createSettingsPage({
        openApplicationLog: runtime.openApplicationLog,
        externalEditor: runtime.externalEditor,
        defineComponent, cache, keys, yaml, fs, Vuex,
        SimpleInput: components.SimpleInput, SelectView: components.SelectView,
        SwitchView: components.SwitchView, draggable, Navigator: components.Navigator,
        Hint: components.Hint, defaultBypass, defaultPac,
        getNetworkInterfaces, electron, path, uuid,
        isMacOS: platform.isMacOS, isWindows: platform.isWindows,
        logger, showMessageBox: utilities.showMessageBox, updateYaml: utilities.updateYaml,
        Info: components.InfoIcon, getWlanInterfaces,
        getLanguage: language,
        setLanguageIndex: runtime.setLanguageIndex,
        languageKey: "language", renderConnectionDisconnectSettings
    });
    const about = createFeedbackPage({
        defineComponent, escCaptureComponent: components.EscCapture, getLanguage: language,
        modifyState, cache, keys, publicContent: runtime.publicContent, shell: electron.shell
    });

    return { home, general, proxy, provider, log: logs, server, connection, router, setting, about };
}

module.exports = { createRendererPages };
