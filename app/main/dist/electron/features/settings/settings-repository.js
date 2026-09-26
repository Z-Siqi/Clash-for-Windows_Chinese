"use strict";

const { writeAtomic } = require("../../core/storage/atomic-file");
const { loadSettingsFromDisk } = require("./load-settings");

function createSettingsRepository({ fs, path, yaml }) {
    return {
        load(clashPath, onProfileLanguage) {
            return loadSettingsFromDisk({ fs, path, yaml, clashPath, onProfileLanguage });
        },
        save(clashPath, settings) {
            if (!clashPath) throw new Error("CFW data directory is not initialized");
            writeAtomic({ fs, path, file: path.join(clashPath, "cfw-settings.yaml"), content: yaml.stringify(settings) });
        }
    };
}

module.exports = { createSettingsRepository };
