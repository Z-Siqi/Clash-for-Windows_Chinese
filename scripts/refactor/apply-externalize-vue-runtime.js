"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const file = path.join(root, "app/main/dist/electron/renderer.js");
const source = fs.readFileSync(file, "utf8");
const startMarker = "            70538: (e, t, i) => {";
const endMarker = "            63878: (e, t, i) => {";
const externalMarker = 'const n = require("vue/dist/vue.runtime.common.prod.js");';

if (source.includes(externalMarker)) {
    console.log("Vue runtime is already externalized.");
    process.exit(0);
}

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || source.indexOf(startMarker, start + 1) >= 0) {
    throw new Error("Could not identify the unique embedded Vue webpack module");
}
const embedded = source.slice(start, end);
if (!embedded.includes('tn.version = "2.7.14"') || embedded.length < 100000) {
    throw new Error("Embedded Vue module did not match the audited 2.7.14 runtime");
}

const replacement = [
    "            70538: (e, t, i) => {",
    '                "use strict";',
    '                const n = require("vue/dist/vue.runtime.common.prod.js");',
    "                i.d(t, {",
    "                    ZP: () => n",
    "                })",
    "            },",
    ""
].join(source.includes("\r\n") ? "\r\n" : "\n");

fs.writeFileSync(file, source.slice(0, start) + replacement + source.slice(end));
console.log(`Externalized ${embedded.length} bytes of embedded Vue runtime.`);
