"use strict";

const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../main/dist/electron/renderer.js");

function rendererLanguage() {
    return require("../../main/dist/electron/core/i18n/language").Language;
}

module.exports = { rendererPath, rendererLanguage };
