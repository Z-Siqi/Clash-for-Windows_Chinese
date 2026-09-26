"use strict";

function createSettingsProxy({ getSettings, saveSettings, cloneDeep }) {
    const settings = getSettings();
    if (!settings) return undefined;
    return new Proxy(cloneDeep(settings), {
        set(target, key, value) {
            // Merge against current state: two components may hold different proxy snapshots.
            const next = cloneDeep(getSettings());
            next[key] = cloneDeep(value);
            saveSettings(next);
            target[key] = value;
            return true;
        }
    });
}

module.exports = { createSettingsProxy };
