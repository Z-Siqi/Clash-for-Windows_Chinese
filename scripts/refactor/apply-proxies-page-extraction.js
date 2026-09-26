"use strict";

const fs = require("node:fs");
const path = require("node:path");

const electronRoot = path.resolve(__dirname, "../../app/main/dist/electron");
const rendererPath = path.join(electronRoot, "renderer.js");
const featurePath = path.join(electronRoot, "features/proxies/page.js");
let source = fs.readFileSync(rendererPath, "utf8");
const startNeedle = "            72094: (e, t, i) => {";
const endNeedle = "            28779: (e, t, i) => {";
const replacement = `            72094: (e, t, i) => {
                "use strict";
                i(71176);
                i(24860);
                i(53614);
                const component = require("./features/proxies/page").createProxiesPage({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    slicedToArray: i.n(i(63038))(),
                    asyncToGenerator: i.n(i(48926))(),
                    toConsumableArray: i.n(i(319))(),
                    defineProperty: i.n(i(59713))(),
                    regenerator: i.n(i(87757))(),
                    Hint: i(13338).Z,
                    Vuex: i(23321),
                    Navigator: i(11287).Z,
                    axios: i.n(i(54387))(),
                    cache: i(24883).Z,
                    keys: i(81518).Z,
                    lodash: i.n(i(24793))(),
                    scripts: i(1581),
                    utilities: i(8369),
                    status: i(33182).Z,
                    velocity: i.n(require("velocity-animate"))(),
                    scheduler: i(71289),
                    getLanguage: function() { return new Language(modifyState.language); }
                });
                i.d(t, { Z: () => component });
            },
`;

if (!source.includes(replacement)) {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0 || end < 0)
        throw new Error("Proxies page boundaries were not found uniquely");
    const block = source.slice(start, end).replace(/\r\n/g, "\n");
    const bodyStart = block.indexOf("                function f(e, t) {");
    const bodyEnd = block.lastIndexOf("\n            },");
    if (bodyStart < 0 || bodyEnd < 0) throw new Error("Proxies page body was not found");
    let body = block.slice(bodyStart, bodyEnd)
        .replace(/new Language\(modifyState\.language\)/g, "getLanguage()")
        .replace("                i(71176);\n                var v = i(51900);", "")
        .replace(/                var b = i\(11287\),[\s\S]*?                    T = i\(71289\);\n/, "")
        .replace("                i(24860), i(53614);", "");
    if (/\bi\(\d+\)|\bmodifyState\b|\bLanguage\b/.test(body))
        throw new Error("Proxies page still contains a webpack/global dependency");
    const feature = `"use strict";

function createProxiesPage({
    defineComponent, slicedToArray, asyncToGenerator, toConsumableArray,
    defineProperty, regenerator, Hint, Vuex, Navigator, axios, cache, keys,
    lodash, scripts, utilities, status, velocity, scheduler, getLanguage
}) {
    var n = slicedToArray,
        o = () => slicedToArray,
        s = asyncToGenerator,
        r = () => asyncToGenerator,
        a = toConsumableArray,
        l = () => toConsumableArray,
        c = defineProperty,
        d = () => defineProperty,
        h = regenerator,
        u = () => regenerator,
        g = { Z: Hint },
        p = Vuex,
        v = { Z(options, render, staticRenderFns, _functional, _injectStyles, scopeId) {
            return { exports: defineComponent(options, render, scopeId, staticRenderFns) };
        } },
        b = { Z: Navigator },
        w = axios,
        y = () => axios,
        C = { Z: cache },
        x = { Z: keys },
        S = lodash,
        k = () => lodash,
        L = scripts,
        N = utilities,
        D = { Z: status },
        I = velocity,
        E = () => velocity,
        T = scheduler;

${body}
    return R;
}

module.exports = { createProxiesPage };
`;
    fs.mkdirSync(path.dirname(featurePath), { recursive: true });
    fs.writeFileSync(featurePath, feature, "utf8");
    source = source.slice(0, start) + replacement + source.slice(end);
    fs.writeFileSync(rendererPath, source, "utf8");
}

console.log("Proxies page extraction applied");
