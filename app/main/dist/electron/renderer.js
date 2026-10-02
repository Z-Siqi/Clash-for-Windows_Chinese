"use strict";

const { startRenderer } = require("./entry/renderer/start-renderer");

const metadata = globalThis.__CFW_BOOTSTRAP__;
module.exports = startRenderer({
    processObject: { platform: metadata.platform, arch: metadata.arch, cwd: () => metadata.cwd, env: {} },
    electronHost: globalThis.__CFW_HOST__.electron
});
