(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var patchLayer = root.__CFW_PATCH_LAYER__;

    if (!patchLayer || typeof patchLayer.registerProbe !== "function") {
        return;
    }

    var source = "app/main/dist/electron/patch-layer/renderer-readiness-probe.js";
    var maxSamples = 6;
    var sampleDelayMs = 25;
    var sampleCount = 0;
    var samples = [];

    function getAppRoot() {
        if (typeof document === "undefined") {
            return null;
        }

        if (typeof document.getElementById === "function") {
            return document.getElementById("app");
        }

        if (typeof document.querySelector === "function") {
            return document.querySelector("#app");
        }

        return null;
    }

    function hasPatchLayerDataset() {
        return !!(
            typeof document !== "undefined" &&
            document.documentElement &&
            document.documentElement.dataset &&
            document.documentElement.dataset.cfwPatchLayer
        );
    }

    function readRendererMarker() {
        return !!root.__CFW_RENDERER_AFTER_PATCH_MARKER__;
    }

    function recordReadinessProbe(name, detail) {
        return patchLayer.registerProbe(name, detail);
    }

    function refreshFlags() {
        patchLayer.readyFlags.rendererReadinessProbeLoaded = true;
        patchLayer.readyFlags.runtimeSmokeLoaded = !!patchLayer.health.runtimeProbeRecordedAt;
        patchLayer.readyFlags.rendererMarkerObserved = readRendererMarker();
        patchLayer.readyFlags.postRendererObserved = patchLayer.readyFlags.postRendererObserved || sampleCount > 0;

        if (typeof patchLayer.getHealth === "function") {
            patchLayer.getHealth();
        }
    }

    function takeSample(reason) {
        sampleCount += 1;

        var sample = {
            reason: reason,
            sampleCount: sampleCount,
            documentReadyState: typeof document !== "undefined" ? document.readyState : null,
            locationHref: typeof location !== "undefined" ? location.href : null,
            appRootPresent: !!getAppRoot(),
            hasPatchLayerDataset: hasPatchLayerDataset(),
            runtimeSmokeLoaded: !!patchLayer.health.runtimeProbeRecordedAt,
            patchLayerReadyEventObserved: !!patchLayer.readyFlags.patchLayerReadyEventObserved,
            readyEventDispatched: !!patchLayer.health.readyEventDispatched,
            rendererMarkerObserved: readRendererMarker()
        };

        samples.push(sample);
        patchLayer.health.rendererReadinessSamples = samples.slice();
        patchLayer.health.rendererReadinessSampleCount = sampleCount;
        refreshFlags();

        recordReadinessProbe("renderer-readiness-sample", sample);
        return sample;
    }

    function scheduleNextSample() {
        if (sampleCount >= maxSamples || typeof root.setTimeout !== "function") {
            return;
        }

        root.setTimeout(function () {
            takeSample("bounded-readiness-sampling");
            scheduleNextSample();
        }, sampleDelayMs);
    }

    if (typeof patchLayer.recordScript === "function") {
        patchLayer.recordScript("renderer-readiness-probe.js", {
            source: source
        });
    }

    refreshFlags();
    recordReadinessProbe("renderer-readiness-probe-loaded", {
        source: source,
        documentReadyState: typeof document !== "undefined" ? document.readyState : null,
        locationHref: typeof location !== "undefined" ? location.href : null,
        appRootPresent: !!getAppRoot(),
        hasPatchLayerDataset: hasPatchLayerDataset(),
        runtimeSmokeLoaded: !!patchLayer.health.runtimeProbeRecordedAt,
        readyEventDispatched: !!patchLayer.health.readyEventDispatched
    });

    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
        document.addEventListener("DOMContentLoaded", function () {
            if (typeof patchLayer.recordEvent === "function") {
                patchLayer.recordEvent("renderer-readiness:DOMContentLoaded");
            }

            takeSample("DOMContentLoaded");
        });
    }

    if (typeof root.addEventListener === "function") {
        root.addEventListener("load", function () {
            if (typeof patchLayer.recordEvent === "function") {
                patchLayer.recordEvent("renderer-readiness:load");
            }

            takeSample("load");
        });
    }

    takeSample("post-readiness-probe-load");
    scheduleNextSample();
}());
