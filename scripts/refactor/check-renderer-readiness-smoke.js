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
    const windowListeners = new Map();
    const documentListeners = new Map();
    const scheduledTimers = [];
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
            _appRoot: {
                id: "app",
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
            }
        }
    };

    runtime.CustomEvent = function CustomEvent(type, options) {
        this.type = type;
        this.detail = options && options.detail ? options.detail : null;
    };

    runtime.Event = function Event(type) {
        this.type = type;
    };

    runtime.addEventListener = function addEventListener(type, listener) {
        const eventListeners = windowListeners.get(type) || [];
        eventListeners.push(listener);
        windowListeners.set(type, eventListeners);
    };

    runtime.dispatchEvent = function dispatchEvent(event) {
        const eventListeners = windowListeners.get(event.type) || [];
        eventListeners.forEach((listener) => listener.call(runtime, event));
        return true;
    };

    runtime.setTimeout = function setTimeout(callback, delay) {
        scheduledTimers.push({
            callback,
            delay
        });
        return scheduledTimers.length;
    };

    runtime.__flushTimers = function flushTimers(maxIterations) {
        const limit = maxIterations || 20;
        let iterations = 0;

        while (scheduledTimers.length > 0 && iterations < limit) {
            const timer = scheduledTimers.shift();
            iterations += 1;
            timer.callback();
        }
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

function dispatchLifecycle(runtime) {
    runtime.document.readyState = "interactive";
    runtime.document.dispatchEvent(new runtime.Event("readystatechange"));
    runtime.document.dispatchEvent(new runtime.Event("DOMContentLoaded"));

    runtime.document.readyState = "complete";
    runtime.document.dispatchEvent(new runtime.Event("readystatechange"));
    runtime.dispatchEvent(new runtime.Event("load"));
}

function main() {
    const runtime = createRuntime();
    const readyEvents = [];
    const context = vm.createContext(runtime);

    runtime.addEventListener("cfw:patch-layer-ready", (event) => {
        readyEvents.push(event);
    });

    runScript(context, rendererPatchPath);
    runScript(context, runtimeProbePath);
    runScript(context, readinessProbePath);

    runtime.__CFW_RENDERER_AFTER_PATCH_MARKER__ = {
        source: "mock-renderer.js",
        loadedAt: new Date().toISOString()
    };

    runtime.__CFW_PATCH_LAYER__.recordScript("mock-renderer.js", {
        source: "scripts/refactor/check-renderer-readiness-smoke.js"
    });

    dispatchLifecycle(runtime);
    runtime.__flushTimers();

    const patchLayer = runtime.__CFW_PATCH_LAYER__;
    const health = patchLayer.getHealth();
    const scriptOrder = health.scriptOrder.map((entry) => entry.name);
    const readinessSamples = patchLayer.health.rendererReadinessSamples || [];
    const lastSample = readinessSamples[readinessSamples.length - 1];

    assert(readyEvents.length === 1, "cfw:patch-layer-ready was not observed exactly once.");
    assert(health.version === "006-enforced-route-delegation", "health.version mismatch.");
    assert(health.hasDocumentElementDataset === true, "patch layer dataset marker is missing.");
    assert(health.appRootPresent === true, "#app was not observed.");
    assert(health.documentReadyState === "complete", "document lifecycle did not reach complete.");
    assert(health.eventCounts["cfw:patch-layer-ready"] === 1, "patch-layer-ready event count mismatch.");
    assert(health.eventCounts.DOMContentLoaded === 1, "DOMContentLoaded event count mismatch.");
    assert(health.eventCounts.load === 1, "load event count mismatch.");
    assert(health.eventCounts.readystatechange === 2, "readystatechange event count mismatch.");
    assert(health.readyFlags.runtimeSmokeLoaded === true, "runtime smoke flag mismatch.");
    assert(health.readyFlags.patchLayerReadyEventObserved === true, "patch-layer-ready observed flag mismatch.");
    assert(health.readyFlags.rendererReadinessProbeLoaded === true, "readiness probe flag mismatch.");
    assert(health.readyFlags.domContentLoadedObserved === true, "DOMContentLoaded flag mismatch.");
    assert(health.readyFlags.loadObserved === true, "load flag mismatch.");
    assert(health.readyFlags.postRendererObserved === true, "post-renderer flag mismatch.");
    assert(health.readyFlags.rendererMarkerObserved === true, "mock renderer marker was not observed.");
    assert(scriptOrder.join(">") === "renderer-patch.js>runtime-smoke-probe.js>renderer-readiness-probe.js>mock-renderer.js", "script order mismatch.");
    assert(patchLayer.probes.some((probe) => probe.name === "renderer-readiness-probe-loaded"), "readiness load probe missing.");
    assert(patchLayer.probes.some((probe) => probe.name === "renderer-readiness-sample"), "readiness sample probe missing.");
    assert(readinessSamples.length >= 2, "bounded readiness samples were not recorded.");
    assert(lastSample.rendererMarkerObserved === true, "post-renderer sample did not observe marker.");
    assert(lastSample.runtimeSmokeLoaded === true, "post-renderer sample did not observe runtime smoke.");

    console.log("Renderer readiness smoke check passed.");
    console.log(`Version: ${health.version}`);
    console.log(`Probe count: ${health.probeCount}`);
    console.log(`Script order: ${scriptOrder.join(" -> ")}`);
    console.log(`Readiness samples: ${readinessSamples.length}`);
}

main();
