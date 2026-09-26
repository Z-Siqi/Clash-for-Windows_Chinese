"use strict";

const fs = require("node:fs");
const path = require("node:path");

const electronRoot = path.resolve(__dirname, "../../app/main/dist/electron");
const rendererPath = path.join(electronRoot, "renderer.js");
const featurePath = path.join(electronRoot, "features/settings/page.js");
let source = fs.readFileSync(rendererPath, "utf8");
const startNeedle = "            99876: (e, t, i) => {";
const endNeedle = "            12436: (e, t, i) => {";
const replacement = `            99876: (e, t, i) => {
                "use strict";
                i(79820); i(47191); i(65549); i(67664); i(15907); i(52611); i(58141);
                const component = require("./features/settings/page").createSettingsPage({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    toConsumableArray: i.n(i(319))(), slicedToArray: i.n(i(63038))(),
                    asyncToGenerator: i.n(i(48926))(), defineProperty: i.n(i(59713))(),
                    regenerator: i.n(i(87757))(), cache: i(24883).Z, keys: i(81518).Z,
                    yaml: i(11442), fs: i(57147), Vuex: i(23321), SimpleInput: i(12436).Z,
                    SelectView: i(17285).Z, SwitchView: i(62639).Z,
                    draggable: i.n(i(51109))(), Navigator: i(11287).Z, Hint: i(13338).Z,
                    defaultBypass: i(8359).Z, defaultPac: i(10870).Z,
                    getNetworkInterfaces: i(97520).r, electron: i(72298), path: i(71017),
                    childProcess: i(32081), uuid: i(251), platform: i(83566), logger: i(86173),
                    utilities: i(8369), Info: i(36336).Z, getWlanInterfaces: i(58511).S,
                    getLanguage: function() { return new Language(modifyState.language); },
                    getLanguageIndex: function() { return modifyState.language; },
                    setLanguageIndex: function(value) { modifyState.language = value; },
                    languageKey: LANGUAGE
                });
                i.d(t, { Z: () => component });
            },
`;

if (!source.includes(replacement)) {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0 || end < 0)
        throw new Error("Settings page boundaries were not found uniquely");
    const block = source.slice(start, end).replace(/\r\n/g, "\n");
    const bodyStart = block.indexOf("                function m(e, t) {");
    const bodyEnd = block.lastIndexOf("\n            },");
    if (bodyStart < 0 || bodyEnd < 0) throw new Error("Settings page body was not found");
    let body = block.slice(bodyStart, bodyEnd)
        .replace(/new Language\(modifyState\.language\)/g, "getLanguage()")
        .replace("modifyState.language = t;", "setLanguageIndex(t);")
        .replace(/i\(24883\)\.Z/g, "cache")
        .replace(/i\(81518\)\.Z/g, "keys")
        .replace(/\bLANGUAGE\b/g, "languageKey")
        .replace("                i(79820);\n                var _ = i(51900);", "")
        .replace("                var w = i(12436);", "")
        .replace("                i(47191);", "")
        .replace("                var k = i(17285),\n                    L = i(62639);", "")
        .replace("                i(65549);", "")
        .replace("                i(67664);", "")
        .replace("                var M = i(51109);", "")
        .replace(/i\.n\(M\)\(\)/g, "draggable")
        .replace("                i(15907);", "")
        .replace(/                var P = i\(11287\),[\s\S]*?                    U = null,/, "                var U = null,")
        .replace(/                    K = i\(251\),[\s\S]*?                    X = i\(58511\);/, "")
        .replace("                    },\n\n\n                function J", "                    };\n\n                function J")
        .replace("                i(52611), i(58141);", "");
    if (/\bi\(\d+\)|\bmodifyState\b|\bLanguage\b/.test(body))
        throw new Error("Settings page still contains a webpack/global dependency");
    const feature = `"use strict";

function createSettingsPage({
    defineComponent, toConsumableArray, slicedToArray, asyncToGenerator, defineProperty,
    regenerator, cache, keys, yaml, fs, Vuex, SimpleInput, SelectView, SwitchView,
    draggable, Navigator, Hint, defaultBypass, defaultPac, getNetworkInterfaces,
    electron, path, childProcess, uuid, platform, logger, utilities, Info,
    getWlanInterfaces, getLanguage, getLanguageIndex, setLanguageIndex, languageKey
}) {
    var n = toConsumableArray,
        o = () => toConsumableArray,
        s = slicedToArray,
        r = () => slicedToArray,
        a = asyncToGenerator,
        l = () => asyncToGenerator,
        c = defineProperty,
        d = () => defineProperty,
        h = regenerator,
        u = () => regenerator,
        g = yaml,
        p = fs,
        f = Vuex,
        _ = { Z(options, render, staticRenderFns, _functional, _injectStyles, scopeId) {
            return { exports: defineComponent(options, render, scopeId, staticRenderFns) };
        } },
        w = { Z: SimpleInput },
        k = { Z: SelectView },
        L = { Z: SwitchView },
        P = { Z: Navigator },
        R = { Z: Hint },
        F = { Z: defaultBypass },
        B = { Z: defaultPac },
        V = { r: getNetworkInterfaces },
        W = electron,
        H = path,
        z = () => path,
        j = childProcess,
        K = uuid,
        q = platform,
        Z = logger,
        G = () => logger,
        Y = utilities,
        Q = { Z: Info },
        X = { S: getWlanInterfaces };

${body}
    return ie;
}

module.exports = { createSettingsPage };
`.replace(/[ \t]+$/gm, "");
    fs.mkdirSync(path.dirname(featurePath), { recursive: true });
    fs.writeFileSync(featurePath, feature, "utf8");
    source = source.slice(0, start) + replacement + source.slice(end);
    fs.writeFileSync(rendererPath, source, "utf8");
}

console.log("Settings page extraction applied");
