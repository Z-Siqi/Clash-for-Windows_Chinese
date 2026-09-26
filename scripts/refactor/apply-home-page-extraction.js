"use strict";

const fs = require("node:fs");
const path = require("node:path");

const electronRoot = path.resolve(__dirname, "../../app/main/dist/electron");
const rendererPath = path.join(electronRoot, "renderer.js");
const featurePath = path.join(electronRoot, "features/home/page.js");
let source = fs.readFileSync(rendererPath, "utf8");
const startNeedle = "            42016: (e, t, i) => {";
const endNeedle = "            58323: (e, t, i) => {";
const replacement = `            42016: (e, t, i) => {
                "use strict";
                i(38619); i(38926); i(74360); i(44977); i(56520); i(51792); i(5513); i(17613); i(69028);
                const component = require("./features/home/page").createHomePage({
                    defineComponent: require("./features/renderer-ui/component").defineComponent,
                    slicedToArray: i.n(i(63038))(), defineProperty: i.n(i(59713))(),
                    toConsumableArray: i.n(i(319))(), asyncToGenerator: i.n(i(48926))(),
                    regenerator: i.n(i(87757))(), Vuex: i(23321), lodash: i.n(i(24793))(),
                    draggable: i.n(i(51109))(), cache: i(24883).Z, statusModule: i(33182),
                    platform: i(83566), runtimeProcess: process, electron: i(72298), requireFromString: i(75110),
                    path: i(71017), fs: i(57147), moment: i.n(i(10605))(), scheduler: i(71289),
                    keys: i(81518).Z, Hint: i(13338).Z, childProcess: i(32081), logger: i(86173),
                    os: i(22037), axios: i(54387), yaml: i(11442), sudoPrompt: i(72378),
                    utilities: i(8369), getNetworkInterfaces: i(97520), store: i(59273).Z,
                    defaultPac: i(10870), Koa: i(15208), getPort: i(97495),
                    downloadProfile: i(419), net: i(41808), runMacCommand: i(19102),
                    updateRuntime: i(84695), uuid: i(251), firewall: i(27458), getWlan: i(58511),
                    mousetrap: i(36267), cron: i(48567),
                    serviceModule: i(63878)("./service_".concat(process.platform)),
                    runtimeState: modifyState, languageKey: LANGUAGE,
                    getLanguage: function() { return new Language(modifyState.language); },
                    refreshRendererProfile: refreshRendererProfile,
                    createRendererConfiguration: createRendererConfiguration,
                    persistSelection: persistSelection,
                    createClashServiceApi: createClashServiceApi,
                    createTunRuntime: createTunRuntime,
                    createClashCoreRuntime: createClashCoreRuntime
                });
                i.d(t, { Z: () => component });
            },
`;

if (!source.includes(replacement)) {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    if (start < 0 || source.indexOf(startNeedle, start + 1) >= 0 || end < 0)
        throw new Error("Home page boundaries were not found uniquely");
    const block = source.slice(start, end).replace(/\r\n/g, "\n");
    const bodyStart = block.indexOf("                function C(e, t) {");
    const bodyEnd = block.lastIndexOf("\n            },");
    if (bodyStart < 0 || bodyEnd < 0) throw new Error("Home page body was not found");
    let body = block.slice(bodyStart, bodyEnd)
        .replace(/new Language\(modifyState\.language\)/g, "getLanguage()")
        .replace(/\bmodifyState\b/g, "runtimeState")
        .replace(/\bLANGUAGE\b/g, "languageKey")
        .replace(/\bprocess\.(platform|arch)\b/g, "runtimeProcess.$1")
        .replace(/i\(24883\)\.Z/g, "_.Z")
        .replace(/i\(81518\)\.Z/g, "W.Z")
        .replace(/i\(22037\)/g, "os")
        .replace(/i\(54387\)/g, "se")
        .replace(/i\(11442\)/g, "ae")
        .replace(/                var L = i\(75110\),[\s\S]*?                    I = i\(24793\);/, "")
        .replace("                i(38619), i(38926);\n                var M = i(51900);", "")
        .replace(/                var O = i\(10605\),[\s\S]*?                    R = i\(71289\);/, "")
        .replace(/                var W = i\(81518\),\n                    H = i\(13338\);/, "")
        .replace("                i(74360);", "")
        .replace("                i(44977);", "")
        .replace("                i(56520);", "")
        .replace(/                var X = i\(32081\),[\s\S]*?                    me = i\(97495\);/, "")
        .replace(/                var be, we, ye = i\(419\),[\s\S]*?                    Ee = i\(58511\);/, "                var be, we;")
        .replace(/                var Pe = i\(24793\),[\s\S]*?                    ze = We\.status;/, "")
        .replace("                i(5513), i(17613), i(69028);", "");
    if (/\bi\(\d+\)|\bmodifyState\b|\bLanguage\b|\bLANGUAGE\b/.test(body))
        throw new Error("Home page still contains a webpack/global dependency");
    const feature = `"use strict";

function createHomePage({
    defineComponent, slicedToArray, defineProperty, toConsumableArray, asyncToGenerator,
    regenerator, Vuex, lodash, draggable, cache, statusModule, platform, runtimeProcess, electron,
    requireFromString, path, fs, moment, scheduler, keys, Hint, childProcess, logger,
    os, axios, yaml, sudoPrompt, utilities, getNetworkInterfaces, store, defaultPac,
    Koa, getPort, downloadProfile, net, runMacCommand, updateRuntime, uuid, firewall,
    getWlan, mousetrap, cron, serviceModule, runtimeState, languageKey, getLanguage,
    refreshRendererProfile, createRendererConfiguration, persistSelection,
    createClashServiceApi, createTunRuntime, createClashCoreRuntime
}) {
    var n = slicedToArray,
        o = () => slicedToArray,
        s = defineProperty,
        r = () => defineProperty,
        a = toConsumableArray,
        l = () => toConsumableArray,
        c = asyncToGenerator,
        d = () => asyncToGenerator,
        h = regenerator,
        u = () => regenerator,
        g = Vuex,
        p = lodash,
        f = () => lodash,
        m = draggable,
        v = () => draggable,
        _ = { Z: cache },
        b = statusModule,
        w = platform,
        y = electron,
        L = requireFromString,
        N = path,
        D = fs,
        I = lodash,
        M = { Z(options, render, staticRenderFns, _functional, _injectStyles, scopeId) {
            return { exports: defineComponent(options, render, scopeId, staticRenderFns) };
        } },
        O = moment,
        P = () => moment,
        R = scheduler,
        W = { Z: keys },
        H = { Z: Hint },
        X = childProcess,
        J = () => childProcess,
        ee = logger,
        te = fs,
        ie = () => fs,
        ne = path,
        oe = () => path,
        se = axios,
        re = () => axios,
        ae = yaml,
        le = () => yaml,
        de = sudoPrompt,
        he = utilities,
        ue = getNetworkInterfaces,
        ge = { Z: store },
        pe = { Z: defaultPac },
        fe = Koa,
        me = getPort,
        ye = downloadProfile,
        Ce = net,
        xe = () => net,
        Se = runMacCommand,
        Ne = updateRuntime,
        De = uuid,
        Ie = firewall,
        Ee = getWlan,
        Pe = lodash,
        Re = requireFromString,
        Fe = mousetrap,
        Be = getPort,
        Ve = cron,
        We = serviceModule,
        He = serviceModule.statusService,
        ze = serviceModule.status;
    const ce = require("marked");
    require("util");

    async function ke(dns) {
        const result = await Se.p(["-dns", dns.length > 0 ? dns.join(",") : "reset"]);
        return result.success;
    }

    async function Le() {
        const result = await Se.p(["-dns", "query"]);
        if (!result.success || !/.+?=(.+?);/.test(result.output)) return [];
        return RegExp.$1.split(",").filter(address => xe().isIP(address));
    }

${body}
    return qe;
}

module.exports = { createHomePage };
`;
    fs.mkdirSync(path.dirname(featurePath), { recursive: true });
    fs.writeFileSync(featurePath, feature, "utf8");
    source = source.slice(0, start) + replacement + source.slice(end);
    fs.writeFileSync(rendererPath, source, "utf8");
}

console.log("Home page extraction applied");
