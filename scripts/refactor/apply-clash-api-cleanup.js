"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath).toString("latin1");

const unavailable = 'if (!e.clashAxiosClient) {';
const unavailableCount = source.split(unavailable).length - 1;
if (unavailableCount !== 2) throw new Error(`expected two client readiness checks, found ${unavailableCount}`);
source = source.split(unavailable).join('if (!e.clashApi.isReady()) {');

const fetchReady = 'if (i = Number.MAX_SAFE_INTEGER, e.clashAxiosClient) {';
if (!source.includes(fetchReady)) throw new Error("proxy fetch readiness check not found");
source = source.replace(fetchReady, 'if (i = Number.MAX_SAFE_INTEGER, e.clashApi.isReady()) {');

const delaySetup = 'return o = t.length > 1 && void 0 !== t[1] ? t[1] : 1e3, s = t.length > 2 && void 0 !== t[2] ? t[2] : "https://www.gstatic.com/generate_204", r = t.length > 3 ? t[3] : void 0, a = encodeURIComponent(e), l = r ? "/providers/proxies/".concat(encodeURIComponent(r.name), "/").concat(a, "/healthcheck") : "/proxies/".concat(a, "/delay"), n.next = 7, i.clashApi.testProxyDelay(e, {';
if (!source.includes(delaySetup)) throw new Error("inline delay URL construction not found");
source = source.replace(
    delaySetup,
    'return o = t.length > 1 && void 0 !== t[1] ? t[1] : 1e3, s = t.length > 2 && void 0 !== t[2] ? t[2] : "https://www.gstatic.com/generate_204", r = t.length > 3 ? t[3] : void 0, n.next = 7, i.clashApi.testProxyDelay(e, {'
);

fs.writeFileSync(rendererPath, Buffer.from(source, "latin1"));
console.log("Clash API cleanup applied");
