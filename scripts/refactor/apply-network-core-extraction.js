"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath);
const bytes = value => Buffer.from(value, "utf8");

function replaceUnique(oldValue, newValue, label) {
    const oldBytes = bytes(oldValue);
    const at = source.indexOf(oldBytes);
    if (at < 0 || source.indexOf(oldBytes, at + 1) >= 0) {
        throw new Error(`${label} anchor was not found uniquely`);
    }
    source = Buffer.concat([
        source.subarray(0, at),
        bytes(newValue),
        source.subarray(at + oldBytes.length)
    ]);
}

replaceUnique(
    'const { createAxiosClient, createGotClient, createWebSocketFactory } = require("./features/clash-core/renderer-clients");',
    'const { parseControllerPort, createAxiosClient, createGotClient, createWebSocketFactory } = require("./core/network/clash-clients");\nconst { createClashApi } = require("./core/network/clash-api");',
    "network imports"
);

replaceUnique(
`                        controllerPort: function(e) {
                            var t = e.confData["external-controller"];
                            if (t) {
                                var i = t.split(":"),
                                    n = d()(i, 2),
                                    o = (n[0], n[1]);
                                return parseInt(o.trim()) || 0
                            }
                            return 0
                        },`,
`                        controllerPort: function(e) {
                            return parseControllerPort(e.confData["external-controller"])
                        },`,
    "controller port getter"
);

replaceUnique(
`                        clashWSClient: function(e, t) {
                            return createWebSocketFactory({ WebSocket: k, controllerPort: t.controllerPort, secret: t.secret })
                        },`,
`                        clashWSClient: function(e, t) {
                            return createWebSocketFactory({ WebSocket: k, controllerPort: t.controllerPort, secret: t.secret })
                        },
                        clashApi: function(e, t) {
                            return createClashApi({ getClient: function() { return t.clashAxiosClient } })
                        },`,
    "Clash API getter"
);

fs.writeFileSync(rendererPath, source);
console.log("network core extraction applied");
