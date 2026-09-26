"use strict";

function createPreloadLoader({
    globalObject,
    documentObject,
    dirname,
    monacoDirectory,
    staticDirectory,
    path,
    pathToFileURL,
    loadModule,
    onError = error => console.error("Failed to load the renderer", error && error.stack ? error.stack : error)
}) {
    const resolvedMonacoDirectory = monacoDirectory || path.join(dirname, "generated", "monaco");
    const resolvedStaticDirectory = staticDirectory || path.join(dirname, "static");
    let started = false;

    function defineRuntimeValue(name, value) {
        Object.defineProperty(globalObject, name, {
            value,
            configurable: false,
            enumerable: false,
            writable: false
        });
    }

    function start() {
        if (started) return;
        started = true;

        try {
            const monacoAssetDirectory = resolvedMonacoDirectory + path.sep;
            if (!globalObject.customElements) {
                const definitions = new Map();
                // Electron's isolated preload world exposes a null customElements
                // registry. Monaco only registers its currently-unused connection
                // observer here, so retain the registration contract locally.
                defineRuntimeValue("customElements", Object.freeze({
                    define(name, constructor) {
                        if (definitions.has(name)) throw new Error(`Custom element already defined: ${name}`);
                        definitions.set(name, constructor);
                    },
                    get(name) {
                        return definitions.get(name);
                    }
                }));
            }
            defineRuntimeValue("__static", resolvedStaticDirectory.replace(/\\/g, "\\\\"));
            defineRuntimeValue("__CFW_MONACO_ASSET_BASE__", pathToFileURL(monacoAssetDirectory).href);
            defineRuntimeValue("__CFW_RENDERER_ASSET_BASE__", pathToFileURL(dirname + path.sep).href);

            // Both scripts must execute in the isolated preload world. Loading either
            // one from index.html would place it in the unprivileged main world where
            // CommonJS globals are intentionally unavailable.
            loadModule(path.join(monacoAssetDirectory, "monaco.js"));
            loadModule(path.join(dirname, "renderer.js"));
        } catch (error) {
            onError(error);
        }
    }

    if (documentObject.readyState === "loading") {
        documentObject.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }

    return Object.freeze({ start });
}

module.exports = { createPreloadLoader };
