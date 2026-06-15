(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var patchLayer = root.__CFW_PATCH_LAYER__;

    if (!patchLayer || typeof patchLayer.registerProbe !== "function") {
        return;
    }

    var source = "app/main/dist/electron/patch-layer/runtime-smoke-probe.js";
    var eventName = "cfw:patch-layer-ready";

    if (typeof patchLayer.recordScript === "function") {
        patchLayer.recordScript("runtime-smoke-probe.js", {
            source: source
        });
    }

    var probe = patchLayer.registerProbe("runtime-smoke-probe-loaded", {
        source: source,
        documentReadyState: typeof document !== "undefined" ? document.readyState : null,
        locationHref: typeof location !== "undefined" ? location.href : null,
        hasPatchLayerDataset: !!(
            typeof document !== "undefined" &&
            document.documentElement &&
            document.documentElement.dataset &&
            document.documentElement.dataset.cfwPatchLayer
        )
    });

    patchLayer.health.runtimeProbeSource = source;
    patchLayer.health.runtimeProbeRecordedAt = probe.recordedAt;
    patchLayer.readyFlags.runtimeSmokeLoaded = true;

    if (typeof patchLayer.getHealth === "function") {
        patchLayer.getHealth();
    }

    if (typeof root.CustomEvent === "function" && typeof root.dispatchEvent === "function") {
        patchLayer.health.readyEventDispatched = true;
        root.dispatchEvent(new root.CustomEvent(eventName, {
            detail: {
                version: patchLayer.version,
                loadedAt: patchLayer.loadedAt,
                source: source,
                health: typeof patchLayer.getHealth === "function" ? patchLayer.getHealth() : patchLayer.health,
                probes: patchLayer.probes.slice()
            }
        }));
    }
}());
