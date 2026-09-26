"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
const original = fs.readFileSync(rendererPath);
let source = original.toString("latin1");

function replaceAll(oldValue, newValue, minimum, label) {
    const parts = source.split(oldValue);
    const count = parts.length - 1;
    if (count < minimum) throw new Error(`${label}: expected at least ${minimum}, found ${count}`);
    source = parts.join(newValue);
}

replaceAll('.clashAxiosClient.delete("connections")', '.clashApi.closeConnections()', 3, "close connections");
replaceAll('.clashAxiosClient.get("connections")', '.clashApi.getConnections()', 1, "get connections");
replaceAll('.clashAxiosClient.get("/proxies")', '.clashApi.getProxies()', 2, "get proxies");
replaceAll('.clashAxiosClient.get("/providers/proxies")', '.clashApi.getProxyProviders()', 1, "get proxy providers");
replaceAll('.clashAxiosClient.get("/providers/rules")', '.clashApi.getRuleProviders()', 1, "get rule providers");
replaceAll('.clashAxiosClient.get("/rules")', '.clashApi.getRules()', 1, "get rules");
replaceAll('.clashAxiosClient.get("/configs")', '.clashApi.getConfig()', 1, "get config");
replaceAll('.clashAxiosClient.get("/version")', '.clashApi.getVersion()', 1, "get version");
replaceAll('.clashAxiosClient.patch("/configs",', '.clashApi.patchConfig(', 5, "patch config");
replaceAll('.clashAxiosClient.put("/configs",', '.clashApi.putConfig(', 1, "put config");

source = source.replace(
    /\.clashAxiosClient\.delete\("connections\/"\.concat\(([^)]+)\)\)/g,
    ".clashApi.closeConnection($1)"
);
source = source.replace(
    /\.clashAxiosClient\.put\("\/providers\/rules\/"\.concat\(encodeURIComponent\(([^)]+)\)\)(?:, \{\})?\)/g,
    ".clashApi.updateRuleProvider($1)"
);
source = source.replace(
    /\.clashAxiosClient\.put\("\/providers\/proxies\/"\.concat\(encodeURIComponent\(([^)]+)\)\), \{\},/g,
    ".clashApi.updateProxyProvider($1,"
);
source = source.replace(
    /\.clashAxiosClient\.get\("\/providers\/proxies\/"\.concat\(encodeURIComponent\(([^)]+)\), "\/healthcheck"\),/g,
    ".clashApi.healthCheckProxyProvider($1,"
);

const newline = source.includes("\r\n") ? "\r\n" : "\n";
replaceAll(
    `                theme: "theme"${newline}`,
    `                theme: "theme",${newline}                clashApi: "clashApi"${newline}`,
    1,
    "global Clash API getter"
);

fs.writeFileSync(rendererPath, Buffer.from(source, "latin1"));
console.log("Clash API call extraction applied");
