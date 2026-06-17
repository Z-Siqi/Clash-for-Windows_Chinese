(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "008-batched-enforced-extractions";
    var source = "app/main/dist/electron/patch-layer/packages/menu/menu-order.js";

    function readOrder(storage, key) {
        if (!storage || typeof storage.get !== "function" || !key) {
            return [];
        }

        var stored = storage.get(key);
        return Array.isArray(stored) ? stored : [];
    }

    function getTitle(value) {
        return value && typeof value.title === "string" ? value.title : "";
    }

    function compareByOrder(order, left, right) {
        var leftIndex = order.findIndex(function (title) {
            return title === getTitle(left);
        });
        var rightIndex = order.findIndex(function (title) {
            return title === getTitle(right);
        });

        if (leftIndex === -1) {
            return 1;
        }

        return leftIndex - rightIndex;
    }

    function compareMenuItems(left, right, storage, key) {
        return compareByOrder(readOrder(storage, key), left, right);
    }

    function sortMenuItems(items, storage, key) {
        var cloned = Array.isArray(items) ? items.slice() : [];
        return cloned.sort(function (left, right) {
            return compareMenuItems(left, right, storage, key);
        });
    }

    var menuOrder = {
        version: version,
        source: source,
        readOrder: readOrder,
        compareByOrder: compareByOrder,
        compareMenuItems: compareMenuItems,
        sortMenuItems: sortMenuItems
    };

    root.__CFW_MENU_ORDER__ = menuOrder;

    if (root.__CFW_PATCH_LAYER__ && typeof root.__CFW_PATCH_LAYER__.recordScript === "function") {
        root.__CFW_PATCH_LAYER__.recordScript("packages/menu/menu-order.js", {
            source: source
        });
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = menuOrder;
    }
}());
