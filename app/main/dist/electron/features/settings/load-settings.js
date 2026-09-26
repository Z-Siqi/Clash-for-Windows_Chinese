"use strict";

const { mergeSettings } = require("./settings-defaults");

function loadSettingsFromDisk({ fs, path, yaml, clashPath, onProfileLanguage }) {
    let settings = {};
    try {
        const configPath = path.join(clashPath, "cfw-settings.yaml");
        const fileContent = fs.readFileSync(configPath).toString();
        settings = yaml.parse(fileContent) || {};
        if (typeof settings !== "object" || Array.isArray(settings)) settings = {};
    } catch (_error) {
        settings = {};
    }

    if (settings.language != null && onProfileLanguage) {
        onProfileLanguage(settings.language);
    }
    return mergeSettings(settings);
}

module.exports = { loadSettingsFromDisk };
