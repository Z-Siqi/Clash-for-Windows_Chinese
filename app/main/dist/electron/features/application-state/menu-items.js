"use strict";

const { createTranslator } = require("../../core/i18n/language");

const MENU_LABELS = {
    "/home/general": "general", "/home/proxy": "proxies", "/home/server": "profiles",
    "/home/log": "logs", "/home/connection": "connections", "/home/setting": "settings",
    "/home/about": "feedback", "/home/provider": "providers", "/home/router": "router"
};
const legacyTitles = new Map();
for (const index of [0, 1]) {
    const labels = createTranslator(index);
    for (const [path, key] of Object.entries(MENU_LABELS)) legacyTitles.set(labels.t(key), path);
}

function localizeMenuItems(items, labels, order = []) {
    // Older preferences used translated titles; resolve either language without losing the order.
    const paths = order.map(item => legacyTitles.get(item) || item);
    return items.map(item => ({
        ...item, title: MENU_LABELS[item.path] ? labels.t(MENU_LABELS[item.path]) : item.title
    })).sort((left, right) => {
        const leftIndex = paths.indexOf(left.path || left.title);
        const rightIndex = paths.indexOf(right.path || right.title);
        return (leftIndex === -1 ? paths.length : leftIndex) - (rightIndex === -1 ? paths.length : rightIndex);
    });
}

module.exports = { localizeMenuItems };
