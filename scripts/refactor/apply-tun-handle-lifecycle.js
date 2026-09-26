"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath).toString("latin1");
const before = `                        spawnTun2socks: async function() {
                            this.tun2socks = await this.createTunRuntime().spawnTun2socks({
                                currentProcess: this.tun2socks,
                                mixedPort: this.mixedPort
                            })
                        },`;
const after = `                        spawnTun2socks: async function() {
                            var previousProcess = this.tun2socks;
                            this.tun2socks = null;
                            this.tun2socks = await this.createTunRuntime().spawnTun2socks({
                                currentProcess: previousProcess,
                                mixedPort: this.mixedPort
                            })
                        },`;

if (!source.includes(before)) {
    throw new Error("Expected TUN process lifecycle block was not found");
}
source = source.replace(before, after);
fs.writeFileSync(rendererPath, Buffer.from(source, "latin1"));
console.log("Updated TUN process handle lifecycle");
