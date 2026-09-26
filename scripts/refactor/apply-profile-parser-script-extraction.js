"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const ascii = value => Buffer.from(value, "ascii");

function replaceModule(startText, endText, replacement, label) {
    const migrated = ascii(replacement);
    if (source.indexOf(migrated) >= 0) return;
    const startNeedle = ascii(startText);
    const endNeedle = ascii(endText);
    const start = source.indexOf(startNeedle);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
        throw new Error(`${label} start was not found uniquely`);
    }
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (end < 0) throw new Error(`${label} end was not found`);
    source = Buffer.concat([source.subarray(0, start), migrated, source.subarray(end)]);
}

replaceModule(
    "            419: (e, t, i) => {",
    "            1581: (e, t, i) => {",
`            419: (e, t, i) => {
                "use strict";
                const lodash = i(24793);
                const parser = require("./features/profiles/profile-parser").createProfileParser({
                    store: i(59273).Z,
                    axios: i(54387),
                    got: i(71893),
                    fs: i(57147),
                    path: i(71017),
                    yaml: i(11442),
                    cloneDeep: lodash.cloneDeep,
                    reduce: lodash.reduce,
                    shuffle: lodash.shuffle,
                    requireFromString: i(75110),
                    Console: i(96206).Console,
                    notify: i(8369).c0,
                    diff3Merge: require("node-diff3").merge,
                    parseContentDisposition: require("content-disposition").parse,
                    HttpsProxyAgent: require("hpagent").HttpsProxyAgent,
                    getLanguage: function() { return new Language(modifyState.language); }
                });
                i.d(t, { rF: () => parser.downloadProfile });
            },
`,
    "profile parser module"
);

replaceModule(
    "            1581: (e, t, i) => {",
    "            44224: (e, t, i) => {",
`            1581: (e, t, i) => {
                "use strict";
                const scripts = require("./features/scripts/user-script-runner");
                const runner = scripts.createUserScriptRunner({
                    store: i(59273).Z,
                    axios: i(54387),
                    yaml: i(11442),
                    fs: require("original-fs"),
                    Console: i(96206).Console,
                    requireFromString: i(75110),
                    notify: i(8369).c0,
                    showMessageBox: i(8369).vC,
                    resolveHost: i(8369).e8
                });
                i.d(t, {
                    lJ: () => scripts.PROFILE_SCRIPT,
                    ay: () => scripts.PROXY_SCRIPT,
                    TX: () => runner.run
                });
            },
`,
    "user script module"
);

fs.writeFileSync(rendererPath, source);
console.log("profile parser and user script extraction applied");
