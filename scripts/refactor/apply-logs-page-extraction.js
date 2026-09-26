"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const ascii = value => Buffer.from(value, "ascii");
const replacement = ascii(`            11969: (e, t, i) => {
                "use strict";
                i(74863);
                i(15586);
                const utilities = i(8369);
                const component = require("./features/logs/page").createLogsPage({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    Vuex: i(23321),
                    getLanguage: function() { return new Language(modifyState.language); },
                    moment: i.n(i(10605))(),
                    flattenValues: utilities.Mf,
                    notify: utilities.c0,
                    uniqueId: i(24793).uniqueId,
                    connectedStatus: i(33182).Z.CONNECTED,
                    clipboard: i(72298).clipboard,
                    readLastLines: require("read-last-lines"),
                    cache: i(24883).Z,
                    keys: i(81518).Z,
                    SelectView: i(17285).Z,
                    normalizeStructuredLog: normalizeStructuredLog,
                    parseCoreLogLine: parseCoreLogLine
                });
                i.d(t, { Z: () => component });
            },
`);

if (source.indexOf(replacement) < 0) {
    const startNeedle = ascii("            11969: (e, t, i) => {");
    const endNeedle = ascii("            38585: (e, t, i) => {");
    const start = source.indexOf(startNeedle);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0)
        throw new Error("Logs page start was not found uniquely");
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (end < 0) throw new Error("Logs page end was not found");
    source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
}

fs.writeFileSync(rendererPath, source);
console.log("Logs page extraction applied");
