"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const ascii = value => Buffer.from(value, "ascii");
const replacement = ascii(`            38585: (e, t, i) => {
                "use strict";
                i(58528);
                i(99648);
                const component = require("./features/providers/page").createProvidersPage({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    Vuex: i(23321),
                    getLanguage: function() { return new Language(modifyState.language); },
                    moment: i.n(i(10605))(),
                    connectedStatus: i(33182).Z.CONNECTED,
                    electron: i(72298),
                    fs: i.n(i(57147))(),
                    path: i(71017),
                    Hint: i(13338).Z
                });
                i.d(t, { Z: () => component });
            },
`);

if (source.indexOf(replacement) < 0) {
    const startNeedle = ascii("            38585: (e, t, i) => {");
    const endNeedle = ascii("            72094: (e, t, i) => {");
    const start = source.indexOf(startNeedle);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
        throw new Error("Providers page start was not found uniquely");
    }
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (end < 0) throw new Error("Providers page end was not found");
    source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
}

fs.writeFileSync(rendererPath, source);
console.log("Providers page extraction applied");
