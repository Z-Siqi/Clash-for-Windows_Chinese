(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var patchLayer = root.__CFW_PATCH_LAYER__;
    var routeCatalog = root.__CFW_ROUTE_CATALOG__;

    if (!patchLayer || typeof patchLayer.registerProbe !== "function") {
        return;
    }

    var source = "app/main/dist/electron/patch-layer/route-readiness-probe.js";
    var probeName = "route-readiness-probe-loaded";
    var sampleName = "route-readiness-sample";
    var samples = [];

    function getLocationSnapshot() {
        if (typeof location === "undefined") {
            return {
                href: null,
                hash: null,
                pathname: null
            };
        }

        return {
            href: location.href || null,
            hash: location.hash || "",
            pathname: location.pathname || ""
        };
    }

    function getVisibleRouteSignals() {
        var signals = {
            appRootPresent: false,
            routerViewPresent: false,
            bodyClassName: null,
            activeElementTagName: null
        };

        if (typeof document === "undefined") {
            return signals;
        }

        var appRoot = typeof document.getElementById === "function" ? document.getElementById("app") : null;
        signals.appRootPresent = !!appRoot;
        signals.bodyClassName = document.body && typeof document.body.className === "string" ? document.body.className : null;
        signals.activeElementTagName = document.activeElement && document.activeElement.tagName ? document.activeElement.tagName : null;

        if (typeof document.querySelector === "function") {
            signals.routerViewPresent = !!document.querySelector("router-view");
        }

        return signals;
    }

    function readRouteReadiness(reason) {
        var locationSnapshot = getLocationSnapshot();
        var match = routeCatalog && typeof routeCatalog.matchRouteFromLocation === "function"
            ? routeCatalog.matchRouteFromLocation(locationSnapshot)
            : {
                observedPath: null,
                matched: false,
                redirected: false,
                fallbackPath: null,
                route: null
            };

        var result = {
            reason: reason,
            source: source,
            catalogVersion: routeCatalog ? routeCatalog.version : null,
            catalogRouteCount: routeCatalog && routeCatalog.routes ? routeCatalog.routes.length : 0,
            menuRouteCount: routeCatalog && typeof routeCatalog.getMenuRoutes === "function" ? routeCatalog.getMenuRoutes().length : 0,
            documentReadyState: typeof document !== "undefined" ? document.readyState : null,
            location: locationSnapshot,
            match: match,
            visibleSignals: getVisibleRouteSignals(),
            patchLayerReadable: !!root.__CFW_PATCH_LAYER__
        };

        samples.push(result);
        patchLayer.health.routeCatalog = routeCatalog ? {
            version: routeCatalog.version,
            source: routeCatalog.source,
            routeCount: routeCatalog.routes.length,
            menuRouteCount: typeof routeCatalog.getMenuRoutes === "function" ? routeCatalog.getMenuRoutes().length : 0,
            fallbackPath: routeCatalog.fallbackPath
        } : null;
        patchLayer.health.routeReadiness = result;
        patchLayer.health.routeReadinessSamples = samples.slice();
        patchLayer.readyFlags.routeReadinessProbeLoaded = true;

        if (typeof patchLayer.getHealth === "function") {
            patchLayer.getHealth();
        }

        patchLayer.registerProbe(sampleName, result);
        return result;
    }

    if (typeof patchLayer.recordScript === "function") {
        patchLayer.recordScript("route-readiness-probe.js", {
            source: source
        });
    }

    patchLayer.registerProbe(probeName, {
        source: source,
        hasRouteCatalog: !!routeCatalog,
        catalogVersion: routeCatalog ? routeCatalog.version : null
    });

    readRouteReadiness("route-probe-load");

    if (typeof root.addEventListener === "function") {
        root.addEventListener("hashchange", function () {
            if (typeof patchLayer.recordEvent === "function") {
                patchLayer.recordEvent("route-readiness:hashchange");
            }

            readRouteReadiness("hashchange");
        });

        root.addEventListener("load", function () {
            readRouteReadiness("load");
        });
    }

    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
        document.addEventListener("DOMContentLoaded", function () {
            readRouteReadiness("DOMContentLoaded");
        });
    }
}());
