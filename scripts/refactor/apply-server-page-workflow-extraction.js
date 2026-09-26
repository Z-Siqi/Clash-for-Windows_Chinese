"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const ascii = value => Buffer.from(value, "ascii");
const replacement = ascii(`                const serverWorkflow = require("./features/profiles/server-page-workflow").createServerPageWorkflow({
                    labels: Lg,
                    getLanguage: function() { return new Language(modifyState.language); },
                    moment: p(),
                    yaml: m(),
                    fs: N,
                    path: I,
                    electron: G,
                    lodash: j,
                    CancelToken: i(54387).CancelToken,
                    downloadProfile: v.rF,
                    runUserScript: J.TX,
                    profileScriptType: J.lJ,
                    scheduler: ee.ZP,
                    confirmOpenExternal: _.fl,
                    cloneJson: _.EP,
                    showMessageBox: _.vC,
                    formatBytes: _.nM
                });
                const he = {
                        data: serverWorkflow.data,
                        components: {
                            draggable: y(),
                            ConfigView: R,
                            RuleView: K,
                            QRCodeView: Q,
                            Hint: X.Z
                        },
                        directives: {
                            focus: {
                                update: function(e, t) {
                                    t.value && e.focus()
                                }
                            }
                        },
                        computed: oe(oe(oe({}, (0, b.mapState)({
                            clashPath: function(e) {
                                return e.app.clashPath
                            },
                            pfs: function(e) {
                                return e.app.profiles
                            },
                            confData: function(e) {
                                return e.app.confData
                            },
                            profilesPath: function(e) {
                                return e.app.profilesPath
                            }
                        })), (0, b.mapGetters)(["clashAxiosClient"])), {}, serverWorkflow.computed),
                        methods: oe(oe({}, (0, b.mapMutations)({
                            changeProfiles: "CHANGE_PROFILES",
                            changeProfilesIndex: "CHANGE_PROFILES_INDEX",
                            changeProfile: "CHANGE_PROFILE",
                            appendProfile: "APPEND_PROFILE",
                            deleteProfile: "DELETE_PROFILE"
                        })), {}, serverWorkflow.methods),
                        beforeRouteEnter: serverWorkflow.beforeRouteEnter,
                        beforeRouteLeave: serverWorkflow.beforeRouteLeave
                    },
                    ue = he;`);

if (source.indexOf(replacement) < 0) {
    const startNeedle = ascii("                var se = i(57147),\r\n                    re = i(71017),\r\n                    ae = i(54387),\r\n                    le = i(24793),\r\n                    ce = ae.CancelToken,\r\n                    de = \"manual-stop\";\r\n                const he = {");
    const endNeedle = ascii("                    ue = he;");
    const start = source.indexOf(startNeedle);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
        throw new Error("server page workflow start was not found uniquely");
    }
    const endStart = source.indexOf(endNeedle, start + startNeedle.length);
    if (endStart < 0) throw new Error("server page workflow end was not found");
    const end = endStart + endNeedle.length;
    source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
}

fs.writeFileSync(rendererPath, source);
console.log("server page workflow extraction applied");
