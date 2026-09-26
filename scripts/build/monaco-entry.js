import * as monaco from "monaco-editor/editor";
import "monaco-editor/features/register.all";
import "monaco-editor/languages/definitions/yaml/register";
import "monaco-editor/languages/definitions/python/register";

const scriptUrl = document.currentScript && document.currentScript.src;
const assetBase = new URL(globalThis.__CFW_MONACO_ASSET_BASE__ || "./", scriptUrl || document.baseURI);

globalThis.MonacoEnvironment = Object.freeze({
    getWorkerUrl() {
        return new URL("editor.worker.js", assetBase).href;
    }
});

Object.defineProperty(globalThis, "__CFW_MONACO__", {
    value: Object.freeze(monaco),
    configurable: false,
    enumerable: false,
    writable: false
});
