"use strict";

function getMonacoRuntime(globalObject) {
    const monaco = globalObject && globalObject.__CFW_MONACO__;
    if (!monaco || typeof monaco.editor?.create !== "function" || typeof monaco.languages?.registerCompletionItemProvider !== "function") {
        throw new Error("The audited Monaco browser runtime did not load before renderer.js");
    }
    return monaco;
}

module.exports = { getMonacoRuntime };
