const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const patchLayerDir = path.join(repoRoot, "app", "main", "dist", "electron", "patch-layer");
const rendererPatchPath = path.join(patchLayerDir, "renderer-patch.js");
const runtimeProbePath = path.join(patchLayerDir, "runtime-smoke-probe.js");
const readinessProbePath = path.join(patchLayerDir, "renderer-readiness-probe.js");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function createRuntime() {
    const listeners = new Map();
    const documentListeners = new Map();
    const runtime = {
        console,
        location: {
            href: "file:///D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree/app/main/dist/electron/index.html"
        },
        document: {
            readyState: "loading",
            documentElement: {
                dataset: {}
            },
            getElementById(id) {
                return id === "app" ? this._appRoot : null;
            },
            querySelector(selector) {
                return selector === "#app" ? this._appRoot : null;
            },
            addEventListener(type, listener) {
                const eventListeners = documentListeners.get(type) || [];
                eventListeners.push(listener);
                documentListeners.set(type, eventListeners);
            },
            dispatchEvent(event) {
                const eventListeners = documentListeners.get(event.type) || [];
                eventListeners.forEach((listener) => listener.call(this, event));
                return true;
            },
            _appRoot: {
                id: "app",
                dataset: {}
            }
        }
    };

    runtime.CustomEvent = function CustomEvent(type, options) {
        this.type = type;
        this.detail = options && options.detail ? options.detail : null;
    };

    runtime.addEventListener = function addEventListener(type, listener) {
        const eventListeners = listeners.get(type) || [];
        eventListeners.push(listener);
        listeners.set(type, eventListeners);
    };

    runtime.dispatchEvent = function dispatchEvent(event) {
        const eventListeners = listeners.get(event.type) || [];
        eventListeners.forEach((listener) => listener.call(runtime, event));
        return true;
    };

    runtime.setTimeout = function setTimeout(callback) {
        callback();
        return 1;
    };

    runtime.window = runtime;
    runtime.globalThis = runtime;
    return runtime;
}

function runScript(context, scriptPath) {
    const source = fs.readFileSync(scriptPath, "utf8");
    const script = new vm.Script(source, {
        filename: scriptPath
    });

    script.runInContext(context);
}

function main() {
    const runtime = createRuntime();
    const readyEvents = [];
    const context = vm.createContext(runtime);

    runtime.addEventListener("cfw:patch-layer-ready", (event) => {
        readyEvents.push(event);
    });

    runScript(context, rendererPatchPath);

    assert(runtime.__CFW_PATCH_LAYER__, "window.__CFW_PATCH_LAYER__ was not created.");
    assert(runtime.document.documentElement.dataset.cfwPatchLayer === "009-large-ipc-settings-runtime-extraction", "documentElement dataset marker was not set.");
    assert(typeof runtime.__CFW_PATCH_LAYER__.registerProbe === "function", "registerProbe API is missing.");
    assert(typeof runtime.__CFW_PATCH_LAYER__.getHealth === "function", "getHealth API is missing.");
    assert(typeof runtime.__CFW_PATCH_LAYER__.recordScript === "function", "recordScript API is missing.");
    assert(typeof runtime.__CFW_PATCH_LAYER__.recordEvent === "function", "recordEvent API is missing.");
    assert(runtime.__CFW_PATCH_LAYER__.probes.length === 1, "core patch layer probe was not registered.");
    assert(readyEvents.length === 0, "ready event should be emitted by the runtime smoke probe, not the core patch layer.");

    runScript(context, runtimeProbePath);

    const patchLayer = runtime.__CFW_PATCH_LAYER__;
    let health = patchLayer.getHealth();

    assert(readyEvents.length === 1, "cfw:patch-layer-ready event was not observed exactly once.");
    assert(patchLayer.health.readyEventDispatched === true, "health.readyEventDispatched was not set.");
    assert(health.version === "009-large-ipc-settings-runtime-extraction", "health.version mismatch.");
    assert(health.probeCount === 2, "health.probeCount mismatch.");
    assert(health.documentReadyState === "loading", "health.documentReadyState mismatch.");
    assert(health.locationHref === runtime.location.href, "health.locationHref mismatch.");
    assert(health.hasDocumentElementDataset === true, "health.hasDocumentElementDataset mismatch.");
    assert(health.appRootPresent === true, "health.appRootPresent mismatch.");
    assert(health.eventCounts["cfw:patch-layer-ready"] === 1, "ready event count mismatch.");
    assert(health.readyFlags.runtimeSmokeLoaded === true, "runtime smoke ready flag mismatch.");
    assert(health.readyFlags.patchLayerReadyEventObserved === true, "ready event observed flag mismatch.");
    assert(patchLayer.probes.some((probe) => probe.name === "runtime-smoke-probe-loaded"), "runtime smoke probe was not registered.");
    assert(readyEvents[0].detail.health.version === "009-large-ipc-settings-runtime-extraction", "ready event health payload mismatch.");
    assert(health.scriptOrder.map((entry) => entry.name).join(">") === "renderer-patch.js>runtime-smoke-probe.js", "initial script order mismatch.");

    console.log("Patch layer smoke check passed.");
    console.log(`Version: ${health.version}`);
    console.log(`Probe count: ${health.probeCount}`);
    console.log(`Ready event observed: ${readyEvents.length}`);
}

main();
