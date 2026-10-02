"use strict";

const { createScriptWorkerRuntime } = require("../../features/scripts/script-worker-runtime");

createScriptWorkerRuntime({
    parentPort: process.parentPort,
    axios: require("axios"), yaml: require("yaml"), fs: require("original-fs"),
    Console: require("console").Console, requireFromString: require("require-from-string")
});
