"use strict";

const Module = require("node:module");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");

// The GUI fixture exercises production UI/composition, with native effects faked.
// Real core-process compatibility is verified by the separate integration tests.
let tapPresent = true;
let tapConfigured = false;
const childProcess = {
    execSync: () => Buffer.from(""), execFileSync: () => Buffer.from(""),
    spawnSync: () => ({ status: 0, stdout: Buffer.from("1"), output: [null, Buffer.from("1"), null] }),
    exec(command, options, callback) {
        const complete = callback || options;
        if (/(?:add|remove)_tap_device\.bat/.test(command)) {
            setTimeout(() => { tapConfigured = tapPresent = /add_tap_device\.bat/.test(command); complete?.(null, "", ""); }, 150);
        } else complete?.(null, "", "");
    },
    execFile(file, args, options, callback) {
        if (file === "powershell.exe" && args.some(arg => /get_tap_state\.ps1$/.test(arg))) {
            (callback || options)?.(null, JSON.stringify({ exists: tapPresent, configured: tapConfigured, interfaceIndex: 41 }), "");
            return;
        }
        const error = file === "netsh" && args.includes("name=cfw-tap") && !tapPresent ? Error("fixture adapter absent") : null;
        (callback || options)?.(error, "", "");
    },
    spawn() {
        return Object.assign(new EventEmitter(), { pid: 0, stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });
    }
};
const serviceApi = {
    ping: async () => ({ status: 503 }), version: async () => ({ status: 503 }),
    start: async () => ({ status: 503 }), stop: async () => ({ status: 200 }),
    shutdown: async () => ({ status: 200 }),
    systemProxy: async () => ({ status: 503 })
};
const originalLoad = Module._load;
Module._load = function loadFixtureModule(request, parent, isMain) {
    const filename = (parent?.filename || "").replace(/\\/g, "/");
    if (filename.includes("/dist/electron/")) {
        if (request === "child_process") return childProcess;
        if (request === "@vscode/sudo-prompt") return { exec: (_command, _options, callback) => callback(null, "", "") };
        if (request.endsWith("/clash-service-api")) return { createClashServiceApi: () => serviceApi };
    }
    return originalLoad.call(this, request, parent, isMain);
};
