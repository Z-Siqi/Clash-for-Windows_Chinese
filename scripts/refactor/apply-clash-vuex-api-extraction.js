"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const bytes = value => Buffer.from(value, "utf8");
const startNeedle = bytes("                    R = {\n                        getMode: function(e) {");
const endNeedle = bytes("                        getParserLogPath: function() {");
const start = source.indexOf(startNeedle);
const end = source.indexOf(endNeedle, start);
if (start < 0 || end < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
    throw new Error("Vuex Clash API action range was not unique");
}
const replacement = bytes(`                    R = {
                        getMode: async function(context) {
                            var commit = context.commit,
                                clashApi = context.getters.clashApi;
                            if (!clashApi) return;
                            const response = await clashApi.getConfig().catch(function() {});
                            if (response && response.status === 200) {
                                commit("CHANGE_MODE", { mode: response.data.mode })
                            }
                        },
                        setMode: async function(context, payload) {
                            var commit = context.commit,
                                clashApi = context.getters.clashApi,
                                mode = payload.mode;
                            if (!clashApi) return;
                            const response = await clashApi.patchConfig({ mode: mode }).catch(function() {});
                            if (response && response.status === 204) {
                                commit("CHANGE_MODE", { mode: mode })
                            }
                        },
`);
source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
fs.writeFileSync(rendererPath, source);
console.log("Vuex Clash API extraction applied");
