"use strict";

const fs = require("fs");
const path = require("path");

const compositionFiles = [
    "renderer.js",
    "entry/renderer/start-renderer.js",
    "entry/renderer/create-pages.js",
    "entry/renderer/create-renderer-runtime.js",
    "entry/renderer/create-renderer-store.js",
    "entry/renderer/create-shared-components.js",
    "entry/renderer/utilities.js",
    "features/application-state/getters.js",
    "features/clash-core/general-page-workflow.js",
    "features/settings/load-settings.js"
];

function readRendererCompositionSource(root) {
    const electronRoot = path.join(root, "app/main/dist/electron");
    return compositionFiles
        .map(file => fs.readFileSync(path.join(electronRoot, file), "utf8"))
        .join("\n");
}

module.exports = { compositionFiles, readRendererCompositionSource };
