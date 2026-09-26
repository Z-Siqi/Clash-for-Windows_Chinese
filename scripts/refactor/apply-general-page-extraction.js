"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const ascii = value => Buffer.from(value, "ascii");
const replacement = ascii(`            72797: (e, t, i) => {
                "use strict";
                i(63473);
                i(38245);
                i(46918);
                i(60768);
                i(98803);
                i(36594);
                i(30145);
                i(19259);
                i(82093);
                const Vuex = i(23321);
                const path = i.n(i(71017))();
                const fs = i.n(i(57147))();
                const moment = i.n(i(10605))();
                const httpClient = i.n(i(71893))();
                const yaml = i.n(i(11442))();
                const logger = i.n(i(86173))();
                const platform = i(83566);
                const electron = i(72298);
                const utilities = i(8369);
                const serviceRuntime = i(63878)("./service_".concat(process.platform));
                const firewallRuntime = i(27458);
                const generalWorkflow = require("./features/clash-core/general-page-workflow").createGeneralPageWorkflow({
                    getLanguage: function() { return new Language(modifyState.language); },
                    path: path,
                    fs: fs,
                    moment: moment,
                    yaml: yaml,
                    httpClient: httpClient,
                    zlib: require("zlib"),
                    tarStream: require("tar-stream"),
                    childProcess: i(32081),
                    sudoExec: i(72378).exec,
                    electron: electron,
                    cache: i(24883).Z,
                    keys: i(81518).Z,
                    getNetworkInterfaces: i(97520).r,
                    platform: { isMacOS: platform.V5, isWindows: platform.Kr, isLinux: platform.IJ },
                    updateApplication: i(84695)._,
                    logger: logger,
                    connectedStatus: i(33182).Z.CONNECTED,
                    service: {
                        needUpdate: serviceRuntime.needUpdate,
                        update: serviceRuntime.updateService,
                        install: serviceRuntime.installService,
                        uninstall: serviceRuntime.uninstallService
                    },
                    firewall: {
                        remove: firewallRuntime.A7,
                        add: firewallRuntime.Kz,
                        status: firewallRuntime.Qz
                    },
                    utilities: {
                        updateYaml: utilities.F0,
                        showMessageBox: utilities.vC,
                        notify: utilities.c0
                    },
                    ensureMixinDefaults: ensureMixinDefaults,
                    validateMixinSettings: validateMixinSettings
                });
                const component = require("./features/clash-core/general-page").createGeneralPage({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    Vuex: Vuex,
                    getLanguage: function() { return new Language(modifyState.language); },
                    version: VERSION,
                    workflow: generalWorkflow,
                    components: {
                        SelectView: i(17285).Z,
                        SwitchView: i(62639).Z,
                        SimpleInput: i(12436).Z,
                        EscCapture: i(72574).Z,
                        InfoIcon: i(36336).Z,
                        Hint: i(13338).Z
                    },
                    shell: electron.shell,
                    fs: fs,
                    yaml: yaml,
                    platform: { isMacOS: platform.V5, isWindows: platform.Kr },
                    utilities: { buildTunConfig: utilities.Sr, showMessageBox: utilities.vC },
                    scheduler: i(71289).ZP,
                    os: i(22037)
                });
                i.d(t, { Z: () => component });
            },
`);

if (source.indexOf(replacement) < 0) {
    const startNeedle = ascii("            72797: (e, t, i) => {");
    const endNeedle = ascii("            11969: (e, t, i) => {");
    const start = source.indexOf(startNeedle);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
        throw new Error("general page start was not found uniquely");
    }
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (end < 0) throw new Error("general page end was not found");
    source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
}

fs.writeFileSync(rendererPath, source);
console.log("general page extraction applied");
