"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(
    __dirname,
    "../../app/main/dist/electron/renderer.js"
);
let source = fs.readFileSync(rendererPath);
const newline = source.includes(Buffer.from("\r\n")) ? "\r\n" : "\n";

if (source.includes(Buffer.from("./features/clash-core/renderer-clients"))) {
    throw new Error("renderer client extraction is already applied");
}

source = insertAfter(
    source,
    `const { mergeSettings } = require("./features/settings/settings-defaults");${newline}`,
    `const { createAxiosClient, createGotClient, createWebSocketFactory } = require("./features/clash-core/renderer-clients");${newline}`
);

source = replaceRange(
    source,
    "                        clashAxiosClient: function(e, t) {",
    "                        resourcesPath: function(e) {",
    [
        "                        clashAxiosClient: function(e, t) {",
        "                            return createAxiosClient({ axios: w(), controllerPort: t.controllerPort, secret: t.secret })",
        "                        },",
        "                        clashGotClient: function(e, t) {",
        "                            return createGotClient({ got: C(), controllerPort: t.controllerPort, secret: t.secret })",
        "                        },",
        "                        clashWSClient: function(e, t) {",
        "                            return createWebSocketFactory({ WebSocket: k, controllerPort: t.controllerPort, secret: t.secret })",
        "                        },",
        ""
    ].join(newline)
);

fs.writeFileSync(rendererPath, source);
console.log("renderer client extraction applied");

function insertAfter(buffer, anchorText, insertionText) {
    const anchor = Buffer.from(anchorText);
    const first = buffer.indexOf(anchor);
    if (first < 0 || buffer.indexOf(anchor, first + 1) >= 0) {
        throw new Error("renderer client insertion anchor must occur exactly once");
    }
    const offset = first + anchor.length;
    return splice(buffer, offset, offset, Buffer.from(insertionText));
}

function replaceRange(buffer, startText, endText, replacementText) {
    const startNeedle = Buffer.from(startText);
    const endNeedle = Buffer.from(endText);
    const start = buffer.indexOf(startNeedle);
    const end = buffer.indexOf(endNeedle, start + startNeedle.length);
    if (start < 0 || end < 0 || buffer.indexOf(startNeedle, start + 1) >= 0) {
        throw new Error(`renderer client range anchors invalid: ${startText}`);
    }
    return splice(buffer, start, end, Buffer.from(replacementText));
}

function splice(buffer, start, end, replacement) {
    return Buffer.concat([buffer.subarray(0, start), replacement, buffer.subarray(end)]);
}
