"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath).toString("latin1");

function replaceOne(oldValue, newValue, label) {
    const first = source.indexOf(oldValue);
    if (first < 0 || source.indexOf(oldValue, first + 1) >= 0) throw new Error(`${label} was not unique`);
    source = source.slice(0, first) + newValue + source.slice(first + oldValue.length);
}

replaceOne(
`e.clashAxiosClient.put("/proxies/" + encodeURIComponent(i), {
                                                    name: n
                                                })`,
    "e.clashApi.selectProxy(i, n)",
    "restore selected proxy"
);
replaceOne(
`n.clashAxiosClient.put("/proxies/".concat(encodeURIComponent(e)), {
                                                name: t
                                            })`,
    "n.clashApi.selectProxy(e, t)",
    "select proxy"
);
replaceOne(
    't.clashAxiosClient.put("/providers/rules/".concat(encodeURIComponent(o)), {}, {',
    "t.clashApi.updateRuleProvider(o, {",
    "update rule provider"
);
replaceOne(
    'return o = "/providers/".concat(e, "/").concat(encodeURIComponent(t)), n.next = 3, i.clashAxiosClient.get(o, {',
    "return n.next = 3, i.clashApi.getProvider(e, t, {",
    "get provider"
);
replaceOne(
    'i.clashAxiosClient(l, {',
    "i.clashApi.testProxyDelay(e, {",
    "proxy delay"
);
replaceOne(
`                                                timeout: 0
                                            });
                                        case 7:
                                            if (c = n.sent`,
`                                                timeout: 0
                                            }, r);
                                        case 7:
                                            if (c = n.sent`,
    "proxy delay provider argument"
);
replaceOne(
    'e.clashAxiosClient.get("/providers/proxies", {',
    "e.clashApi.getProxyProviders({",
    "get proxy providers with status"
);
replaceOne(
`e.clashAxiosClient.get("/dns/query", {
                                                params: {
                                                    name: e.searchHost,
                                                    type: e.searchType
                                                }
                                            })`,
    "e.clashApi.queryDns(e.searchHost, e.searchType)",
    "DNS query"
);
replaceOne(
    'e.clashAxiosClient.post("/cache/fakeip/flush", {}, {',
    "e.clashApi.flushFakeIpCache({",
    "flush fake IP"
);
replaceOne(
`e.clashAxiosClient.post("/script", {
                                                metadata: e.metadata,
                                                script: i
                                            })`,
`e.clashApi.runScript({
                                                metadata: e.metadata,
                                                script: i
                                            })`,
    "run script"
);

const utilityStart = source.indexOf("                    Z = (M = d()(u().mark((function e(t, i) {");
const utilityEndAnchor = "            },\n            97520: (e, t, i) => {";
const utilityEnd = source.indexOf(utilityEndAnchor, utilityStart);
if (utilityStart < 0 || utilityEnd < 0) throw new Error("DNS utility range not found");
const utilityReplacement = `                    Z = async function(name, type) {
                        var clashApi = _.Z && _.Z.getters && _.Z.getters.clashApi;
                        if (!clashApi || !clashApi.isReady()) throw new Error("Clash Core is not ready");
                        var response = await clashApi.queryDns(name, type);
                        return response == null ? undefined : response.data
                    }
`;
source = source.slice(0, utilityStart) + utilityReplacement + source.slice(utilityEnd);

fs.writeFileSync(rendererPath, Buffer.from(source, "latin1"));
console.log("remaining Clash API calls extracted");
