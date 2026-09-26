"use strict";

const fs = require("node:fs");
const path = require("node:path");

const electronRoot = path.resolve(__dirname, "../../app/main/dist/electron");
const rendererPath = path.join(electronRoot, "renderer.js");
const featurePath = path.join(electronRoot, "features/connections/page.js");
let source = fs.readFileSync(rendererPath, "utf8");

const startNeedle = "            14196: (e, t, i) => {";
const endNeedle = "            72797: (e, t, i) => {";
const replacement = `            14196: (e, t, i) => {
                "use strict";
                i(96340);
                i(46029);
                const utilities = i(8369);
                const component = require("./features/connections/page").createConnectionsPage({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    asyncToGenerator: i.n(i(48926))(),
                    toConsumableArray: i.n(i(319))(),
                    defineProperty: i.n(i(59713))(),
                    regenerator: i.n(i(87757))(),
                    Hint: i(13338).Z,
                    cache: i(24883).Z,
                    keys: i(81518).Z,
                    moment: i.n(i(10605))(),
                    Vuex: i(23321),
                    connectedStatus: i(33182).Z.CONNECTED,
                    path: i.n(i(71017))(),
                    EscCapture: i(72574).Z,
                    formatBytes: utilities.nM,
                    flattenValues: utilities.Mf,
                    notify: utilities.c0,
                    clipboard: i(72298).clipboard,
                    getLanguage: function() { return new Language(modifyState.language); },
                    getLanguageIndex: function() { return modifyState.language; },
                    normalizeConnectionsSnapshot: normalizeConnectionsSnapshot
                });
                i.d(t, { Z: () => component });
            },
`;

if (!source.includes(replacement)) {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0 || end < 0)
        throw new Error("Connections page boundaries were not found uniquely");
    const block = source.slice(start, end).replace(/\r\n/g, "\n");
    const bodyStart = block.indexOf("                function x(e, t) {");
    const bodyEnd = block.lastIndexOf("\n            },");
    if (bodyStart < 0 || bodyEnd < 0) throw new Error("Connections page body was not found");
    let body = block.slice(bodyStart, bodyEnd);
    body = body
        .replace(/new Language\(modifyState\.language\)/g, "getLanguage()")
        .replace(/modifyState\.language === 0/g, "getLanguageIndex() === 0")
        .replace("                i(96340);\n                var L = i(51900);", "")
        .replace("                i(46029);", "");
    if (/\bi\(\d+\)|\bmodifyState\b|\bLanguage\b/.test(body))
        throw new Error("Connections page still contains a webpack/global dependency");
    const feature = `"use strict";

function createConnectionsPage({
    defineComponent, asyncToGenerator, toConsumableArray, defineProperty, regenerator,
    Hint, cache, keys, moment, Vuex, connectedStatus, path, EscCapture,
    formatBytes, flattenValues, notify, clipboard, getLanguage, getLanguageIndex,
    normalizeConnectionsSnapshot
}) {
    var n = asyncToGenerator,
        o = () => asyncToGenerator,
        s = toConsumableArray,
        r = () => toConsumableArray,
        a = defineProperty,
        l = () => defineProperty,
        c = regenerator,
        d = () => regenerator,
        h = { Z: Hint },
        u = { Z: cache },
        g = { Z: keys },
        p = moment,
        f = () => moment,
        m = Vuex,
        v = { Z: { CONNECTED: connectedStatus } },
        _ = path,
        b = () => path,
        w = { Z: EscCapture },
        y = { nM: formatBytes, Mf: flattenValues, c0: notify },
        C = { clipboard },
        L = { Z(options, render, staticRenderFns, _functional, _injectStyles, scopeId) {
            return { exports: defineComponent(options, render, scopeId, staticRenderFns) };
        } };

${body}
    return T;
}

module.exports = { createConnectionsPage };
`;
    fs.mkdirSync(path.dirname(featurePath), { recursive: true });
    fs.writeFileSync(featurePath, feature, "utf8");
    source = source.slice(0, start) + replacement + source.slice(end);
    fs.writeFileSync(rendererPath, source, "utf8");
}

// The first historical run used a byte-preserving latin1 read before the extracted
// Chinese object keys made the new UTF-8 module encoding relevant. Repair that
// one generated form idempotently without touching the bundle.
if (fs.existsSync(featurePath)) {
    const generated = fs.readFileSync(featurePath, "utf8");
    if (generated.includes("ä¸"))
        fs.writeFileSync(featurePath, Buffer.from(generated, "latin1").toString("utf8"), "utf8");
}

console.log("Connections page extraction applied");
