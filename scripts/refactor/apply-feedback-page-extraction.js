"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const ascii = value => Buffer.from(value, "ascii");
const replacement = ascii(`            58323: (e, t, i) => {
                "use strict";
                i(56656);
                i(19743);
                i(71131);
                i(72890);
                const component = require("./features/feedback/page").createFeedbackPage({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    escCaptureComponent: i(72574).Z,
                    Language: Language,
                    modifyState: modifyState,
                    cache: i(24883).Z,
                    keys: i(81518).Z,
                    httpClient: i(54387),
                    shell: i(72298).shell
                });
                i.d(t, { Z: () => component });
            },
`);

if (source.indexOf(replacement) < 0) {
    const startNeedle = ascii("            58323: (e, t, i) => {");
    const endNeedle = ascii("            14196: (e, t, i) => {");
    const start = source.indexOf(startNeedle);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
        throw new Error("feedback page start was not found uniquely");
    }
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (end < 0) throw new Error("feedback page end was not found");
    source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
}

fs.writeFileSync(rendererPath, source);
console.log("feedback page extraction applied");
