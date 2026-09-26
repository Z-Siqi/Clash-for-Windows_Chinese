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
    'const { buildTunConfig } = require("./features/tun/build-tun-config");',
    'const { buildTunConfig } = require("./features/tun/build-tun-config");\nconst { createTunRuntime } = require("./features/tun/tun-runtime");',
    "TUN runtime import"
);

const startNeedle = bytes("                        sudoRunBAT: function(e) {");
const endNeedle = bytes("                        getClashStatus: function() {");
const start = source.indexOf(startNeedle);
const end = source.indexOf(endNeedle, start);
if (start < 0 || end < 0 || source.indexOf(startNeedle, start + 1) >= 0) {
    throw new Error("TUN runtime method range was not unique");
}

const replacement = bytes(`                        createTunRuntime: function() {
                            return createTunRuntime({
                                childProcess: J(),
                                sudoExec: de.exec,
                                path: oe(),
                                platform: process.platform,
                                arch: process.arch,
                                filesPath: this.filesPath,
                                tapInfo: _.Z.get(W.Z.TAP_INFO),
                                logger: ee,
                                sleep: he.Dc
                            })
                        },
                        sudoRunBAT: function(command) {
                            var callback = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null;
                            return this.createTunRuntime().sudoRun(command, callback)
                        },
                        setupTapDevice: function() {
                            var install = !(arguments.length > 0 && void 0 !== arguments[0]) || arguments[0];
                            return this.createTunRuntime().setupTapDevice(install)
                        },
                        spawnTun2socks: async function() {
                            var previousProcess = this.tun2socks;
                            this.tun2socks = null;
                            this.tun2socks = await this.createTunRuntime().spawnTun2socks({
                                currentProcess: previousProcess,
                                mixedPort: this.mixedPort
                            })
                        },
                        killSpawned: function(processHandle) {
                            return this.createTunRuntime().killSpawned(processHandle)
                        },
                        setRoutes: function() {
                            return this.createTunRuntime().setRoutes()
                        },
`);
source = Buffer.concat([source.subarray(0, start), replacement, source.subarray(end)]);
fs.writeFileSync(rendererPath, source);
console.log("TUN runtime extraction applied");
