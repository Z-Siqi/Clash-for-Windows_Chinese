"use strict";

const asyncToGenerator = require("@babel/runtime/helpers/asyncToGenerator");
const defineProperty = require("@babel/runtime/helpers/defineProperty");
const slicedToArray = require("@babel/runtime/helpers/slicedToArray");
const toConsumableArray = require("@babel/runtime/helpers/toConsumableArray");
const regenerator = require("@babel/runtime/regenerator");
const dhcp = require("dhcp");
const qrcode = require("qrcode");
const readLastLines = require("read-last-lines");
const tarStream = require("tar-stream");
const zlib = require("zlib");
const draggable = require("vuedraggable");

const { createClashApi } = require("../../core/network/clash-api");
const { createClashServiceApi } = require("../../core/network/clash-service-api");
const { connectionStatus, proxyStatus } = require("../../features/application-state/status");
const { normalizeConnectionsSnapshot, normalizeStructuredLog, parseCoreLogLine } = require("../../features/clash-core/core-api-compat");
const { createClashCoreRuntime } = require("../../features/clash-core/clash-core-runtime");
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
const { createTunRuntime } = require("../../features/tun/tun-runtime");
const { createRendererConfiguration } = require("./configuration");
const { refreshProfile } = require("./refresh-profile");
const { persistSelection } = require("../../features/profiles/persist-selection");

function createRendererPages({ Vuex, Language, modifyState, runtime, components, version }) {
    const language = () => new Language(modifyState.language);
    const languageIndex = () => modifyState.language;
    const {
        axios, cache, childProcess, cron, defaultBypass, defaultPac, electron, firewall,
        fs, getPort, getDefaultInterface, getNetworkInterfaces, getWlanInterfaces,
        Koa, keys, lodash, logger, moment, mousetrap, net, os, path, platform,
        profileParser, requireFromString, runMacSystemProxyCommand, scheduler,
        scripts, serviceModule, store, sudoPrompt, updateApplication, utilities,
        uuid, yaml
    } = runtime;

    const home = createHomePage({
        defineComponent, Vuex, lodash, draggable, cache,
        connectionStatus, proxyStatus, runtimeProcess: process, electron,
        requireFromString, path, fs, moment, scheduler,
        keys, Hint: components.Hint, childProcess, logger, os,
        httpClient: axios, yaml, sudoPrompt,
        validatePort: utilities.isPortInRange, notify: utilities.notify,
        showMessageBox: utilities.showMessageBox, updateYaml: utilities.updateYaml,
        hash: utilities.hashText,
        sleep: utilities.delay, shouldReplaceWintun: utilities.isNewVersion,
        detectInterface: getDefaultInterface, store, defaultPac, Koa, getPort,
        downloadProfile: profileParser.downloadProfile, net,
        runMacCommand: runMacSystemProxyCommand, uuid,
        firewallRuleExists: firewall.status, getWlanInterfaces,
        mousetrap, cron, serviceStatus: serviceModule.statusService,
        serviceActiveStatus: serviceModule.status.Active,
        runtimeState: modifyState, languageKey: "language", getLanguage: language,
        refreshRendererProfile: refreshProfile, createRendererConfiguration,
        persistSelection, createClashServiceApi, createTunRuntime, createClashCoreRuntime,
        isMacOS: platform.isMacOS, isWindows: platform.isWindows,
        isLinux: platform.isLinux, currentTarget: platform.assetTarget,
        updateTargets: {
            windowsX64: platform.windowsX64,
            windowsIa32: platform.windowsX86,
            windowsArm64: platform.windowsArm64,
            macArm64: platform.macArm64,
            macX64: platform.macX64,
            linuxX64: platform.linuxX64
        }
    });

    const generalWorkflow = createGeneralPageWorkflow({
        getLanguage: language, path, fs, moment, yaml, httpClient: require("got"), zlib,
        tarStream, childProcess, sudoExec: sudoPrompt.exec, electron, cache, keys,
        getNetworkInterfaces,
        platform: {
            isMacOS: platform.isMacOS,
            isWindows: platform.isWindows,
            isLinux: platform.isLinux
        },
        updateApplication, logger, connectedStatus: connectionStatus.CONNECTED,
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
        validateMixinSettings
    });
    const general = createGeneralPage({
        defineComponent, Vuex, getLanguage: language, version, workflow: generalWorkflow,
        components, shell: electron.shell, fs, yaml,
        platform: { isMacOS: platform.isMacOS, isWindows: platform.isWindows },
        utilities: {
            buildTunConfig: utilities.buildTunConfig,
            showMessageBox: utilities.showMessageBox
        },
        scheduler,
        os
    });

    const logs = createLogsPage({
        defineComponent, Vuex, getLanguage: language, moment,
        flattenValues: utilities.flattenValues, notify: utilities.notify,
        uniqueId: lodash.uniqueId, connectedStatus: connectionStatus.CONNECTED,
        clipboard: electron.clipboard, readLastLines, cache, keys,
        SelectView: components.SelectView, normalizeStructuredLog, parseCoreLogLine
    });
    const provider = createProvidersPage({
        defineComponent, Vuex, getLanguage: language, moment,
        connectedStatus: connectionStatus.CONNECTED, electron, fs, path,
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
        defineComponent, Vuex, getLanguage: language, electron, cache, keys, dhcp,
        getNetworkInterfaces,
        getHijackAddresses: () => store.state.app.routerHijackMacAddresses || []
    });

    const ProfileEditor = createProfileEditor({
        defineComponent, Vuex, getLanguage: language, buildProxyConfig,
        fs, path, yaml, draggable
    });
    const RuleEditor = createRuleEditor({
        defineComponent, Vuex, getLanguage: language, moment, yaml, fs, path, lodash,
        notify: utilities.notify, cloneJson: utilities.cloneJson
    });
    const serverWorkflow = createServerPageWorkflow({
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
        defineComponent, cache, keys, yaml, fs, Vuex,
        SimpleInput: components.SimpleInput, SelectView: components.SelectView,
        SwitchView: components.SwitchView, draggable, Navigator: components.Navigator,
        Hint: components.Hint, defaultBypass, defaultPac,
        getNetworkInterfaces, electron, path, childProcess, uuid,
        isMacOS: platform.isMacOS, isWindows: platform.isWindows,
        logger, showMessageBox: utilities.showMessageBox, updateYaml: utilities.updateYaml,
        Info: components.InfoIcon, getWlanInterfaces,
        getLanguage: language,
        setLanguageIndex: value => { modifyState.language = value; },
        languageKey: "language", renderConnectionDisconnectSettings
    });
    const about = createFeedbackPage({
        defineComponent, escCaptureComponent: components.EscCapture, Language,
        modifyState, cache, keys, httpClient: axios, shell: electron.shell
    });

    return { home, general, proxy, provider, log: logs, server, connection, router, setting, about };
}

module.exports = { createRendererPages };
