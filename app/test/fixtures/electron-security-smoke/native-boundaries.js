"use strict";

const Module = require("node:module");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");

// The GUI fixture exercises production UI/composition, with native effects faked.
// Real core-process compatibility is verified by the separate integration tests.
const childProcess = {
    execSync: () => Buffer.from(""), execFileSync: () => Buffer.from(""),
    spawnSync: () => ({ status: 0, stdout: Buffer.from("1"), output: [null, Buffer.from("1"), null] }),
    exec(_command, options, callback) { (callback || options)?.(null, "", ""); },
    execFile(_file, args, options, callback) { (callback || options)?.(null, "", ""); },
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
