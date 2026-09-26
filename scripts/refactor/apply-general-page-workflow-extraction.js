"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const ascii = value => Buffer.from(value, "ascii");
const replacement = ascii(`                const generalWorkflow = require("./features/clash-core/general-page-workflow").createGeneralPageWorkflow({
                    getLanguage: function() { return new Language(modifyState.language); },
                    path: g(),
                    fs: f(),
                    moment: v(),
                    yaml: A(),
                    httpClient: b(),
                    zlib: S(),
                    tarStream: L(),
                    childProcess: N,
                    sudoExec: i(72378).exec,
                    electron: P,
                    cache: E.Z,
                    keys: I.Z,
                    getNetworkInterfaces: T.r,
                    platform: { isMacOS: O.V5, isWindows: O.Kr, isLinux: O.IJ },
                    updateApplication: w._,
                    logger: C(),
                    connectedStatus: D.Z.CONNECTED,
                    service: { needUpdate: Ce, update: xe, install: Se, uninstall: ke },
                    firewall: { remove: _e.A7, add: _e.Kz, status: _e.Qz },
                    utilities: { updateYaml: R.F0, showMessageBox: R.vC, notify: R.c0 },
                    ensureMixinDefaults: ensureMixinDefaults,
                    validateMixinSettings: validateMixinSettings
                });
                const Le = {
                    components: {
                        ErrorView: H,
                        TunSettingsView: le,
                        ResetDNSSettingsView: ue,
                        InterfacesView: fe,
                        SwitchView: $.Z,
                        SelectView: U.Z,
                        InfoIcon: me.Z,
                        Hint: ve.Z
                    },
                    props: [],
                    data: generalWorkflow.data,
                    watch: generalWorkflow.watch,
                    computed: we(we(we({}, (0, h.mapState)({
                        devMode: function(e) {
                            return e.app.isDevMode
                        },
                        clashPath: function(e) {
                            return e.app.clashPath
                        },
                        clashStatus: function(e) {
                            return e.app.clashStatus
                        },
                        confData: function(e) {
                            return e.app.confData
                        },
                        isMixinEnable: function(e) {
                            return e.app.isMixinEnable
                        },
                        isTunEnable: function(e) {
                            return e.app.isTunEnable
                        },
                        status: function(e) {
                            return e.app.status
                        },
                        isWindowShow: function(e) {
                            return e.app.isWindowShow
                        },
                        isLocalMode: function(e) {
                            return e.app.isLocalMode
                        },
                        isLaunching: function(e) {
                            return e.app.isLaunching
                        },
                        isSystemProxyOn: function(e) {
                            return e.app.isSystemProxyOn
                        },
                        isSilentUpgraded: function(e) {
                            return e.app.isSilentUpgraded
                        },
                        updateDownloadProgress: function(e) {
                            return e.app.updateDownloadProgress
                        },
                        isFirewallRuleExist: function(e) {
                            return e.app.isFirewallRuleExist
                        },
                        currentProfilePayload: function(e) {
                            return e.app.currentProfilePayload
                        },
                        matchedSSID: function(e) {
                            return e.app.matchedSSID
                        }
                    })), (0, h.mapGetters)(["resourcesPath", "filesPath", "mixedPort", "clashAxiosClient", "controllerPort", "secret"])), {}, generalWorkflow.computed),
                    methods: we(we({}, (0, h.mapMutations)({
                        changeIsMixinEnable: "CHANGE_IS_MIXIN_ENABLE",
                        changeIsTunEnable: "CHANGE_IS_TUN_ENABLE",
                        setIsLocalMode: "SET_IS_LOCAL_MODE",
                        setConfData: "SET_CONF_DATA",
                        setIsSystemProxyOn: "SET_IS_SYSTEM_PROXY_ON",
                        setIsFirewallRuleExist: "SET_IS_FIREWALL_RULE_EXIST"
                    })), {}, generalWorkflow.methods),
                    mounted: generalWorkflow.mounted,
                    beforeRouteEnter: generalWorkflow.beforeRouteEnter,
                    beforeRouteLeave: generalWorkflow.beforeRouteLeave
                };`);

if (source.indexOf(replacement) < 0) {
    const startNeedle = ascii("                const Le = {\r\n                    components: {");
    const endNeedle = ascii("                };\r\n                i(19259), i(82093);");
    const start = source.indexOf(startNeedle);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
        throw new Error("general page workflow start was not found uniquely");
    }
    const endStart = source.indexOf(endNeedle, start + startNeedle.length);
    if (endStart < 0) throw new Error("general page workflow end was not found");
    const optionsEnd = endStart + ascii("                };").length;
    source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(optionsEnd)]);
}

fs.writeFileSync(rendererPath, source);
console.log("general page workflow extraction applied");
