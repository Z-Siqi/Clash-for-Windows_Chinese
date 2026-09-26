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

if (source.indexOf(bytes('./features/tun/build-tun-config')) < 0) {
    replaceUnique(
        'const { createClashApi } = require("./core/network/clash-api");',
        'const { createClashApi } = require("./core/network/clash-api");\nconst { buildTunConfig } = require("./features/tun/build-tun-config");',
        "TUN import"
    );
}
replaceUnique("                    Sr: () => $ ,".replace("$ ,", "$,"), "                    Sr: () => buildTunConfig,", "TUN export");

const startNeedle = bytes("                    $ = function(e) {");
const endNeedle = bytes("                    K = function e(t) {");
const end = source.indexOf(endNeedle);
const start = source.lastIndexOf(startNeedle, end);
if (start < 0 || end < 0 || end - start > 10000) throw new Error("inline TUN config block was not found");
source = Buffer.concat([source.subarray(0, start), source.subarray(end)]);

fs.writeFileSync(rendererPath, source);
console.log("TUN config extraction applied");
