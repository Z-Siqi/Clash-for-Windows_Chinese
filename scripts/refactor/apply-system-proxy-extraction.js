"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const bytes = value => Buffer.from(value, "utf8");
function replaceUnique(oldValue, newValue, label) {
    const oldBytes = bytes(oldValue);
    const at = source.indexOf(oldBytes);
    if (at < 0 || source.indexOf(oldBytes, at + 1) >= 0) throw new Error(`${label} was not unique`);
    source = Buffer.concat([source.subarray(0, at), bytes(newValue), source.subarray(at + oldBytes.length)]);
}

replaceUnique(
    'const { createClashCoreRuntime } = require("./features/clash-core/clash-core-runtime");',
    'const { createClashCoreRuntime } = require("./features/clash-core/clash-core-runtime");\nconst { createSystemProxyRuntime } = require("./features/network/system-proxy-runtime");',
    "system proxy import"
);

const startNeedle = bytes("        function A(e, t) {\n            var i, n = t.store;");
const endNeedle = bytes("            }, e.prototype.$getTrayIcon = function(e) {");
const start = source.indexOf(startNeedle);
const end = source.indexOf(endNeedle, start);
if (start < 0 || end < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
    throw new Error("system proxy plugin range was not unique");
}
const replacement = bytes(`        function A(e, t) {
            var n = t.store;
            function systemProxyRuntime() {
                return createSystemProxyRuntime({
                    platform: process.platform,
                    childProcess: E,
                    path: Tray,
                    filesPath: n.getters.filesPath,
                    clashPath: n.state.app.clashPath,
                    runMacCommand: D.p,
                    parseBypass: x.parse,
                    defaultBypass: N.Z,
                    logger: L()
                })
            }
            e.prototype.$setSystemProxy = async function(enabled) {
                const success = await systemProxyRuntime().set({
                    enabled: enabled,
                    settings: n.state.app.settings,
                    mixedPort: n.getters.mixedPort,
                    innerServerPort: n.state.app.innerServerPort
                });
                if (success) n.commit("CHANGE_STATUS", {
                    status: enabled ? C.r.SYSTEM_PROXY : C.r.DEFAULT
                });
                return success
            }, e.prototype.$getSystemProxyStatus = function() {
                const enabled = systemProxyRuntime().getStatus();
                n.commit("CHANGE_STATUS", {
                    status: enabled ? C.r.SYSTEM_PROXY : C.r.DEFAULT
                });
                return enabled
`);
source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
fs.writeFileSync(rendererPath, source);
console.log("system proxy extraction applied");
