"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const ascii = value => Buffer.from(value, "ascii");
const replacement = ascii(`            74775: (e, t, i) => {
                "use strict";
                i(34954);
                i(7840);
                i(60420);
                i(48619);
                i(72852);
                i(20988);
                i(91924);
                i(3930);
                i(78518);
                i(28318);
                i(51734);
                const Vuex = i(23321);
                const fs = i.n(i(57147))();
                const path = i.n(i(71017))();
                const yaml = i.n(i(11442))();
                const moment = i.n(i(10605))();
                const lodash = i(24793);
                const draggable = i.n(i(51109))();
                const electron = i(72298);
                const utilities = i(8369);
                const scripts = i(1581);
                const labels = new Language(modifyState.language);
                const ProfileEditor = require("./features/profiles/profile-editor-page").createProfileEditor({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    Vuex: Vuex,
                    getLanguage: function() { return new Language(modifyState.language); },
                    buildProxyConfig: buildProxyConfig,
                    fs: fs,
                    path: path,
                    yaml: yaml,
                    draggable: draggable
                });
                const RuleEditor = require("./features/profiles/rule-editor-page").createRuleEditor({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    Vuex: Vuex,
                    getLanguage: function() { return new Language(modifyState.language); },
                    moment: moment,
                    yaml: yaml,
                    fs: fs,
                    path: path,
                    lodash: lodash,
                    notify: utilities.c0,
                    cloneJson: utilities.EP
                });
                const serverWorkflow = require("./features/profiles/server-page-workflow").createServerPageWorkflow({
                    labels: labels,
                    getLanguage: function() { return new Language(modifyState.language); },
                    moment: moment,
                    yaml: yaml,
                    fs: fs,
                    path: path,
                    electron: electron,
                    lodash: lodash,
                    CancelToken: i(54387).CancelToken,
                    downloadProfile: i(419).rF,
                    runUserScript: scripts.TX,
                    profileScriptType: scripts.lJ,
                    scheduler: i(71289).ZP,
                    confirmOpenExternal: utilities.fl,
                    cloneJson: utilities.EP,
                    showMessageBox: utilities.vC,
                    formatBytes: utilities.nM
                });
                const component = require("./features/profiles/server-page").createServerPage({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    Vuex: Vuex,
                    getLanguage: function() { return new Language(modifyState.language); },
                    getLanguageIndex: function() { return modifyState.language; },
                    workflow: serverWorkflow,
                    draggable: draggable,
                    ProfileEditor: ProfileEditor,
                    RuleEditor: RuleEditor,
                    Hint: i(13338).Z,
                    qrcode: i.n(require("qrcode"))(),
                    shortenText: utilities.XW,
                    confirmOpenExternal: utilities.fl
                });
                i.d(t, { Z: () => component });
            },
`);

if (source.indexOf(replacement) < 0) {
    const startNeedle = ascii("            74775: (e, t, i) => {");
    const endNeedle = ascii("            99876: (e, t, i) => {");
    const start = source.indexOf(startNeedle);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
        throw new Error("Server page start was not found uniquely");
    }
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (end < 0) throw new Error("Server page end was not found");
    source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
}

fs.writeFileSync(rendererPath, source);
console.log("Server page extraction applied");
