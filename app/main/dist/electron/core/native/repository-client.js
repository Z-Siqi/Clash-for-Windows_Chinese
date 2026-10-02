"use strict";

function createRepositoryClients({ ipcRenderer, getHome }) {
    function call(operation, request) {
        // Synchronous persistence preserves Vuex's publish-after-success contract.
        const result = ipcRenderer.sendSync("cfw-repository", operation, request);
        if (!result || result.ok !== true) throw new Error(result?.error || "Application repository operation failed");
        return result.value;
    }
    async function profileFiles(operation, profilesPath, extra = {}) {
        const result = await ipcRenderer.invoke("profile-files", operation, { home: getHome(), profilesPath, ...extra });
        if (!result?.ok) throw new Error(result?.error || "Profile file operation failed");
        return result.value;
    }
    return Object.freeze({
        settings: Object.freeze({
            load(home, onProfileLanguage) {
                const result = call("settings-load", { home });
                if (result.language != null) onProfileLanguage?.(result.language);
                return result.settings;
            },
            save: (home, settings) => call("settings-save", { home, settings })
        }),
        profiles: Object.freeze({
            initialize: profilesPath => call("profiles-initialize", { home: getHome(), profilesPath }),
            load: profilesPath => call("profiles-load", { home: getHome(), profilesPath }),
            save: (profilesPath, profiles) => call("profiles-save", { home: getHome(), profilesPath, profiles }),
            readProfile: (profilesPath, time) => profileFiles("read-profile", profilesPath, { time }),
            writeProfile: (profilesPath, time, source) => profileFiles("write-profile", profilesPath, { time, source }),
            createLocal: (profilesPath, sourceTime, source) => profileFiles("create-local", profilesPath, { sourceTime, source }),
            importDialog: profilesPath => profileFiles("import-dialog", profilesPath),
            deleteProfile: (profilesPath, time) => profileFiles("delete-profile", profilesPath, { time }),
            openProfile: (profilesPath, time) => profileFiles("open-profile", profilesPath, { time }),
            revealProfile: (profilesPath, time) => profileFiles("reveal-profile", profilesPath, { time }),
            readDiff: (profilesPath, time) => profileFiles("read-diff", profilesPath, { time }),
            initializeDiff: (profilesPath, time) => profileFiles("initialize-diff", profilesPath, { time }),
            writeDiff: (profilesPath, time, source) => profileFiles("write-diff", profilesPath, { time, source }),
            deleteDiff: (profilesPath, time) => profileFiles("delete-diff", profilesPath, { time }),
            watch(profilesPath, onChange) {
                const receive = (_event, filename) => onChange(filename);
                ipcRenderer.on("profile-files-changed", receive);
                profileFiles("watch", profilesPath).catch(() => ipcRenderer.removeListener("profile-files-changed", receive));
                return { close() {
                    ipcRenderer.removeListener("profile-files-changed", receive);
                    profileFiles("stop-watch", profilesPath).catch(() => {});
                } };
            },
            modificationTimes: profilesPath => profileFiles("modification-times", profilesPath),
            cleanupOrphans: profilesPath => profileFiles("cleanup-orphans", profilesPath)
        })
    });
}

module.exports = { createRepositoryClients };
