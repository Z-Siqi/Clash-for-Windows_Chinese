(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "008-batched-enforced-extractions";
    var source = "app/main/dist/electron/patch-layer/packages/settings/settings-defaults.js";
    var defaultTrayOrders = [["icon"], ["status", "traffic", "text"]];
    var defaultRunTimeFormat = "hh : mm : ss";

    function cloneTrayOrders(value) {
        var orders = Array.isArray(value) ? value : defaultTrayOrders;

        return orders.map(function (group) {
            return Array.isArray(group) ? group.slice() : group;
        });
    }

    function normalizeSettings(settings) {
        var value = settings || {};

        return {
            showNewVersionIcon: value.showNewVersionIcon !== false,
            hideAfterStartup: value.hideAfterStartup === true,
            randomControllerPort: value.randomControllerPort !== false,
            runTimeFormat: value.runTimeFormat || defaultRunTimeFormat,
            trayOrders: cloneTrayOrders(value.trayOrders),
            hideTrayIcon: value.hideTrayIcon === true,
            connShowProcess: value.connShowProcess !== false,
            showTrayProxyDelayIndicator: value.showTrayProxyDelayIndicator !== false,
            checkForUpdates: value.checkForUpdates !== false,
            disableLoadingAdsLink: value.disableLoadingAdsLink !== false
        };
    }

    function mergeSettings(settings) {
        var value = settings || {};
        var normalized = normalizeSettings(value);
        var merged = {};

        Object.keys(value).forEach(function (key) {
            merged[key] = value[key];
        });

        Object.keys(normalized).forEach(function (key) {
            merged[key] = normalized[key];
        });

        return merged;
    }

    var settingsDefaults = {
        version: version,
        source: source,
        defaultRunTimeFormat: defaultRunTimeFormat,
        defaultTrayOrders: cloneTrayOrders(defaultTrayOrders),
        normalizeSettings: normalizeSettings,
        mergeSettings: mergeSettings
    };

    root.__CFW_SETTINGS_DEFAULTS__ = settingsDefaults;

    if (root.__CFW_PATCH_LAYER__ && typeof root.__CFW_PATCH_LAYER__.recordScript === "function") {
        root.__CFW_PATCH_LAYER__.recordScript("packages/settings/settings-defaults.js", {
            source: source,
            defaultRunTimeFormat: defaultRunTimeFormat
        });
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = settingsDefaults;
    }
}());
