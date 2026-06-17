(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "007-menu-current-route-extraction";
    var source = "app/main/dist/electron/patch-layer/packages/menu/menu-state.js";
    var currentRouteStorageKey = "currentRoutePath";
    var defaultFallbackPath = root.__CFW_ROUTE_CATALOG__ && root.__CFW_ROUTE_CATALOG__.fallbackPath
        ? root.__CFW_ROUTE_CATALOG__.fallbackPath
        : "/home/general";

    function readStoredValue(storage, key) {
        if (!storage || typeof storage.get !== "function" || !key) {
            return null;
        }

        return storage.get(key);
    }

    function getInitialCurrentRoutePath(storage, key, fallbackPath) {
        var resolvedFallbackPath = fallbackPath || defaultFallbackPath;
        var storedValue = readStoredValue(storage, key || currentRouteStorageKey);

        return storedValue || resolvedFallbackPath;
    }

    var menuState = {
        version: version,
        source: source,
        currentRouteStorageKey: currentRouteStorageKey,
        fallbackPath: defaultFallbackPath,
        readStoredValue: readStoredValue,
        getInitialCurrentRoutePath: getInitialCurrentRoutePath
    };

    root.__CFW_MENU_STATE__ = menuState;

    if (root.__CFW_PATCH_LAYER__ && typeof root.__CFW_PATCH_LAYER__.recordScript === "function") {
        root.__CFW_PATCH_LAYER__.recordScript("packages/menu/menu-state.js", {
            source: source,
            fallbackPath: defaultFallbackPath
        });
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = menuState;
    }
}());
