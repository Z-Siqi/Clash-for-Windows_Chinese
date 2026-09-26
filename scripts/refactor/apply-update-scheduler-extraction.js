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
    "            71289: (e, t, i) => {",
    "            419: (e, t, i) => {",
`            71289: (e, t, i) => {
                "use strict";
                const scheduler = require("./core/runtime/interval-scheduler").createIntervalScheduler({
                    isActive: function() { return i(59273).Z.state.app.isWindowShow; },
                    createId: i(24793).uniqueId
                });
                i.d(t, { ZP: () => scheduler });
            },
`,
    "interval scheduler module"
);

replaceModule(
    "            84695: (e, t, i) => {",
    "            8359: (e, t, i) => {",
`            84695: (e, t, i) => {
                "use strict";
                const runtime = require("./features/application/update-runtime").createUpdateRuntime({
                    isMacOS: i(83566).V5(),
                    path: i(71017),
                    ipcRenderer: i(72298).ipcRenderer,
                    store: i(59273).Z,
                    execSync: i(32081).execSync
                });
                i.d(t, { _: () => runtime.install });
            },
`,
    "application update module"
);

fs.writeFileSync(rendererPath, source);
console.log("update runtime and interval scheduler extraction applied");
