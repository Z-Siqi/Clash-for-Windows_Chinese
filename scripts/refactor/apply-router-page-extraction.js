"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const ascii = value => Buffer.from(value, "ascii");
const replacement = ascii(`            28779: (e, t, i) => {
                "use strict";
                i(91781);
                i(67078);
                const store = i(59273).Z;
                const component = require("./features/router/page").createRouterPage({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    Vuex: i(23321),
                    getLanguage: function() { return new Language(modifyState.language); },
                    electron: i(72298),
                    cache: i(24883).Z,
                    keys: i(81518).Z,
                    dhcp: i.n(require("dhcp"))(),
                    getNetworkInterfaces: i(97520).r,
                    getHijackAddresses: function() { return store.state.app.routerHijackMacAddresses || []; }
                });
                i.d(t, { Z: () => component });
            },
`);

if (source.indexOf(replacement) < 0) {
    const startNeedle = ascii("            28779: (e, t, i) => {");
    const endNeedle = ascii("            74775: (e, t, i) => {");
    const start = source.indexOf(startNeedle);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
        throw new Error("Router page start was not found uniquely");
    }
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (end < 0) throw new Error("Router page end was not found");
    source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
}

fs.writeFileSync(rendererPath, source);
console.log("Router page extraction applied");
