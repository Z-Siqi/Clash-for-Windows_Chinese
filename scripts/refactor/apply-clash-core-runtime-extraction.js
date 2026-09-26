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
function replaceRange(startValue, endValue, replacement, label) {
    const startBytes = bytes(startValue);
    const endBytes = bytes(endValue);
    const start = source.indexOf(startBytes);
    const end = source.indexOf(endBytes, start);
    if (start < 0 || end < 0 || source.indexOf(startBytes, start + 1) >= 0) throw new Error(`${label} was not unique`);
    source = Buffer.concat([source.subarray(0, start), bytes(replacement), source.subarray(end)]);
}

replaceUnique(
    'const { createTunRuntime } = require("./features/tun/tun-runtime");',
    'const { createTunRuntime } = require("./features/tun/tun-runtime");\nconst { createClashCoreRuntime } = require("./features/clash-core/clash-core-runtime");',
    "Clash runtime import"
);

replaceRange(
    "                        killClashCore: function() {",
    "                        handlerRestartClash: function() {",
`                        createClashCoreRuntime: function() {
                            return createClashCoreRuntime({
                                childProcess: J(),
                                fs: ie(),
                                path: oe(),
                                serviceClient: re(),
                                logger: ee
                            })
                        },
                        killClashCore: async function() {
                            await this.createClashCoreRuntime().stop({
                                processHandle: this.clash,
                                lightweightMode: _.Z.get(W.Z.IS_LIGHTWEIGHT_MODE_CLOSE) || false,
                                platform: process.platform
                            });
                            this.clash = null
                        },
`,
    "Clash stop"
);

replaceRange(
    "                        spawnClash: function() {",
    "                        createTunRuntime: function() {",
`                        spawnClash: async function() {
                            var self = this;
                            const Lg = new Language(modifyState.language);
                            const result = await this.createClashCoreRuntime().start({
                                clashPath: this.clashPath,
                                binaryPath: this.clashBinaryPath,
                                logLevel: this.confData["log-level"],
                                isLocalMode: this.isLocalMode,
                                portableMode: this.portableMode,
                                devMode: this.devMode,
                                lightweightMode: _.Z.get(W.Z.IS_LIGHTWEIGHT_MODE_CLOSE) || false,
                                clashApi: this.clashApi,
                                startupErrorMessage: Lg.clashCoreFailedStartup(),
                                onLogFile: function(logPath) {
                                    self.setLogFilePath({ path: logPath })
                                },
                                onCoreReady: async function() {
                                    self.setClashStatus({ status: await self.getClashStatus() })
                                },
                                onServiceFallback: async function() {
                                    self.setIsLocalMode({ isLocal: true });
                                    await self.spawnClash()
                                }
                            });
                            if (result.processHandle) {
                                this.clash = result.processHandle;
                                _.Z.put(W.Z.LAST_CLASH_PID, result.processHandle.pid)
                            }
                        },
`,
    "Clash start"
);

replaceRange(
    "                        getClashStatus: function() {",
    "                        checkForUpdate: function() {",
`                        getClashStatus: async function() {
                            const result = await this.createClashCoreRuntime().getStatus(this.clashApi);
                            this.clashMixedPort = result.mixedPort;
                            return result.connected ? b.Z.CONNECTED : b.Z.DISCONNECTED
                        },
`,
    "Clash status"
);

fs.writeFileSync(rendererPath, source);
console.log("Clash core runtime extraction applied");
