(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var patchLayer = root.__CFW_PATCH_LAYER__;

    if (!patchLayer || typeof patchLayer.registerProbe !== "function") {
        return;
    }

    var source = "app/main/dist/electron/patch-layer/store-module-visibility-probe.js";
    var maxSamples = 4;
    var sampleCount = 0;
    var samples = [];

    function getAppRoot() {
        if (typeof document === "undefined") {
            return null;
        }

        if (typeof document.getElementById === "function") {
            return document.getElementById("app");
        }

        return null;
    }

    function readVueSignals() {
        var appRoot = getAppRoot();
        var vueInstance = appRoot && appRoot.__vue__ ? appRoot.__vue__ : null;
        var store = vueInstance && vueInstance.$store ? vueInstance.$store : null;

        return {
            hasGlobalVue: !!root.Vue,
            hasVueDevtoolsHook: !!root.__VUE_DEVTOOLS_GLOBAL_HOOK__,
            appRootHasVue: !!vueInstance,
            appRootVueName: vueInstance && vueInstance.$options ? vueInstance.$options.name || null : null,
            hasStore: !!store,
            storeStateKeys: store && store.state ? Object.keys(store.state).sort() : [],
            storeGetterKeys: store && store.getters ? Object.keys(store.getters).sort() : [],
            hasRouter: !!(vueInstance && vueInstance.$router),
            currentRoutePath: vueInstance && vueInstance.$route ? vueInstance.$route.path || null : null
        };
    }

    function readWebpackSignals() {
        return {
            hasWebpackChunkArray: Object.keys(root).some(function (key) {
                return key.indexOf("webpackChunk") === 0;
            }),
            hasWebpackRequire: typeof root.__webpack_require__ === "function"
        };
    }

    function takeSample(reason) {
        sampleCount += 1;

        var sample = {
            reason: reason,
            source: source,
            sampleCount: sampleCount,
            documentReadyState: typeof document !== "undefined" ? document.readyState : null,
            vue: readVueSignals(),
            webpack: readWebpackSignals(),
            patchLayerReadable: !!root.__CFW_PATCH_LAYER__
        };

        samples.push(sample);
        patchLayer.health.storeModuleVisibility = sample;
        patchLayer.health.storeModuleVisibilitySamples = samples.slice();
        patchLayer.readyFlags.storeModuleVisibilityProbeLoaded = true;

        if (typeof patchLayer.getHealth === "function") {
            patchLayer.getHealth();
        }

        patchLayer.registerProbe("store-module-visibility-sample", sample);
        return sample;
    }

    function scheduleSample(reason) {
        if (sampleCount >= maxSamples || typeof root.setTimeout !== "function") {
            return;
        }

        root.setTimeout(function () {
            takeSample(reason);
        }, 50);
    }

    if (typeof patchLayer.recordScript === "function") {
        patchLayer.recordScript("store-module-visibility-probe.js", {
            source: source
        });
    }

    patchLayer.registerProbe("store-module-visibility-probe-loaded", {
        source: source
    });

    takeSample("store-probe-load");
    scheduleSample("post-renderer-delay");

    if (typeof root.addEventListener === "function") {
        root.addEventListener("load", function () {
            takeSample("load");
            scheduleSample("post-load-delay");
        });
    }
}());
