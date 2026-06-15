(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "006-enforced-route-delegation";
    var probes = [];
    var scriptOrder = [];
    var eventCounts = {};
    var readyFlags = {
        patchLayerLoaded: true,
        runtimeSmokeLoaded: false,
        patchLayerReadyEventObserved: false,
        rendererReadinessProbeLoaded: false,
        routeReadinessProbeLoaded: false,
        storeModuleVisibilityProbeLoaded: false,
        ipcSurfacePresenceProbeLoaded: false,
        domContentLoadedObserved: false,
        loadObserved: false,
        postRendererObserved: false,
        rendererMarkerObserved: false
    };
    var health = {
        version: version,
        loadedAt: new Date().toISOString(),
        source: "app/main/dist/electron/patch-layer/renderer-patch.js",
        probeCount: 0,
        documentReadyState: null,
        locationHref: null,
        hasDocumentElementDataset: false,
        appRootPresent: false,
        eventCounts: eventCounts,
        scriptOrder: scriptOrder,
        readyFlags: readyFlags,
        readyEventDispatched: false
    };

    function hasDocument() {
        return typeof document !== "undefined";
    }

    function getAppRootPresence() {
        if (!hasDocument()) {
            return false;
        }

        if (typeof document.getElementById === "function") {
            return !!document.getElementById("app");
        }

        if (typeof document.querySelector === "function") {
            return !!document.querySelector("#app");
        }

        return false;
    }

    function copyEventCounts() {
        var result = {};
        Object.keys(eventCounts).forEach(function (name) {
            result[name] = eventCounts[name];
        });
        return result;
    }

    function copyReadyFlags() {
        var result = {};
        Object.keys(readyFlags).forEach(function (name) {
            result[name] = readyFlags[name];
        });
        return result;
    }

    function readRuntimeState() {
        var documentExists = hasDocument();

        health.probeCount = probes.length;
        health.documentReadyState = documentExists ? document.readyState : null;
        health.locationHref = typeof location !== "undefined" ? location.href : null;
        health.hasDocumentElementDataset = !!(
            documentExists &&
            document.documentElement &&
            document.documentElement.dataset &&
            document.documentElement.dataset.cfwPatchLayer
        );
        health.appRootPresent = getAppRootPresence();

        return {
            version: health.version,
            loadedAt: health.loadedAt,
            source: health.source,
            probeCount: health.probeCount,
            documentReadyState: health.documentReadyState,
            locationHref: health.locationHref,
            hasDocumentElementDataset: health.hasDocumentElementDataset,
            appRootPresent: health.appRootPresent,
            eventCounts: copyEventCounts(),
            scriptOrder: scriptOrder.slice(),
            probes: probes.slice(),
            readyFlags: copyReadyFlags(),
            readyEventDispatched: health.readyEventDispatched,
            routeCatalog: health.routeCatalog || null,
            routeReadiness: health.routeReadiness || null,
            storeModuleVisibility: health.storeModuleVisibility || null,
            ipcSurfacePresence: health.ipcSurfacePresence || null
        };
    }

    function recordEvent(name) {
        eventCounts[name] = (eventCounts[name] || 0) + 1;

        if (name === "DOMContentLoaded") {
            readyFlags.domContentLoadedObserved = true;
        }

        if (name === "load") {
            readyFlags.loadObserved = true;
        }

        if (name === "cfw:patch-layer-ready") {
            readyFlags.patchLayerReadyEventObserved = true;
        }

        readRuntimeState();
    }

    function recordScript(name, detail) {
        var entry = {
            name: name,
            detail: detail || {},
            recordedAt: new Date().toISOString()
        };

        scriptOrder.push(entry);
        readRuntimeState();
        return entry;
    }

    function registerProbe(name, detail) {
        var probe = {
            name: name,
            detail: detail || {},
            recordedAt: new Date().toISOString()
        };

        probes.push(probe);
        readRuntimeState();
        return probe;
    }

    var patchLayer = {
        version: version,
        loadedAt: health.loadedAt,
        source: health.source,
        health: health,
        probes: probes,
        scriptOrder: scriptOrder,
        eventCounts: eventCounts,
        readyFlags: readyFlags,
        recordEvent: recordEvent,
        recordScript: recordScript,
        registerProbe: registerProbe,
        getHealth: readRuntimeState
    };

    root.__CFW_PATCH_LAYER__ = patchLayer;

    if (typeof document !== "undefined" && document.documentElement) {
        if (!document.documentElement.dataset) {
            document.documentElement.dataset = {};
        }

        document.documentElement.dataset.cfwPatchLayer = version;
    }

    recordScript("renderer-patch.js", {
        source: health.source
    });

    if (typeof root.addEventListener === "function") {
        root.addEventListener("cfw:patch-layer-ready", function () {
            recordEvent("cfw:patch-layer-ready");
        });

        root.addEventListener("load", function () {
            recordEvent("load");
        });
    }

    if (hasDocument() && typeof document.addEventListener === "function") {
        document.addEventListener("DOMContentLoaded", function () {
            recordEvent("DOMContentLoaded");
        });

        document.addEventListener("readystatechange", function () {
            recordEvent("readystatechange");
        });
    }

    registerProbe("patch-layer-core-loaded", {
        href: typeof location !== "undefined" ? location.href : null,
        hasDocument: hasDocument(),
        appRootPresent: getAppRootPresence()
    });
}());
