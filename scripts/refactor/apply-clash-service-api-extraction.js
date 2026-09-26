"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath).toString("latin1");

const importAnchor = 'const { createClashApi } = require("./core/network/clash-api");';
if (!source.includes(importAnchor)) throw new Error("Clash API import not found");
source = source.replace(
    importAnchor,
    `${importAnchor}\nconst { createClashServiceApi } = require("./core/network/clash-service-api");`
);

const pingPattern = /([A-Za-z_$][\w$]*(?:\(\))?)\.get\("http:\/\/127\.0\.0\.1:53000\/ping", \{\s*timeout: 5e3\s*\}\)/g;
const pingMatches = [...source.matchAll(pingPattern)];
if (pingMatches.length !== 3) throw new Error(`expected three service ping calls, found ${pingMatches.length}`);
source = source.replace(pingPattern, "createClashServiceApi({ client: $1 }).ping()");

const commandCall = `g().post("http://127.0.0.1:53000/command", {
                                        path: (0, p.join)(r, "sysproxy"),
                                        args: i
                                    })`;
if (!source.includes(commandCall)) throw new Error("macOS service command call not found");
source = source.replace(
    commandCall,
    'createClashServiceApi({ client: g() }).command((0, p.join)(r, "sysproxy"), i)'
);

const runtimeClient = "                                serviceClient: re(),";
if (!source.includes(runtimeClient)) throw new Error("Clash runtime service client wiring not found");
source = source.replace(
    runtimeClient,
    "                                serviceApi: createClashServiceApi({ client: re() }),"
);

fs.writeFileSync(rendererPath, Buffer.from(source, "latin1"));
console.log("Clash service API extraction applied");
