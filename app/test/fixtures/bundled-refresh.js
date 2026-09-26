"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const yaml = require("../../main/node_modules/yaml");
const { refreshProfile } = require("../../main/dist/electron/entry/renderer/refresh-profile");
const { rendererLanguage } = require("./renderer-harness");
const { homePage } = require("./home-page");
function bundledRefresh(platform = process.platform, locale = 1) {
    return homePage({
        runtimeProcess: { platform, arch: process.arch },
        refreshRendererProfile: refreshProfile,
        runtimeState: { languageInProfile: -1, language: locale, isTun: false, isMixin: false, adImages: "" },
        getLanguage: () => new (rendererLanguage())(locale), fs, path, yaml,
        childProcess: { execSync() { throw Error("No operating system commands in application tests"); } },
        requireFromString: code => { const module = { exports: {} }; Function("module", code)(module); return module.exports; },
        utilities: { Ll: value => crypto.createHash("md5").update(value).digest("hex"), c0() {} },
        runMacCommand: { p() { throw Error("No DNS changes in application tests"); } },
        getPort() {}, logger: { transports: { console: {}, file: {} }, warn() {} }
    }).methods.refreshProfile;
}

module.exports = { bundledRefresh };
