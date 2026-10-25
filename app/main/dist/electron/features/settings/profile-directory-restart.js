"use strict";

const { writeAtomic } = require("../../core/storage/atomic-file");

function createProfileDirectoryRestart({ activity, settings, fs, path, app, uuid, validateDirectory, stopWatchers,
    schedule = setImmediate, platform = process.platform }) {
    let prepared = null;
    const normalize = value => platform === "win32" ? value.toLowerCase() : value;
    const requireToken = (sender, token) => {
        if (!prepared || prepared.committed || prepared.sender !== sender || prepared.token !== token) throw new Error("Invalid profile restart request");
        return prepared;
    };
    return {
        prepare(sender, home, directory, reset = false) {
            if (typeof directory !== "string" || directory.length > 4096 || directory.includes("\0") || typeof reset !== "boolean") throw new Error("Invalid profile directory");
            const release = activity.freeze();
            try {
                const current = settings.load(home);
                const target = directory.trim() ? path.resolve(directory.trim()) : "";
                if (!reset && normalize(current.profilePath ? path.resolve(current.profilePath) : "") === normalize(target)) {
                    release(); return { unchanged: true };
                }
                validateDirectory(target || path.join(home, "profiles"), { isDefault: !target });
                const file = path.join(home, "cfw-settings.yaml");
                prepared = { sender, token: uuid(), home, current, target, reset, file,
                    previous: fs.existsSync(file) ? fs.readFileSync(file) : null, release };
                return { token: prepared.token };
            } catch (error) { release(); throw error; }
        },
        cancel(sender, token) {
            const state = requireToken(sender, token);
            prepared = null; state.release();
        },
        abandon(sender) {
            if (prepared?.sender === sender && !prepared.committed) {
                prepared.release(); prepared = null;
            }
        },
        commit(sender, token) {
            const state = requireToken(sender, token);
            state.committed = true;
            let saved = false;
            try {
                // Nothing publishes the new directory into the old renderer.
                settings.save(state.home, state.reset ? {} : { ...state.current, profilePath: state.target });
                saved = true;
                app.relaunch();
            } catch (error) {
                if (saved) {
                    try {
                        if (state.previous !== null) writeAtomic({ fs, path, file: state.file, content: state.previous });
                        else if (fs.existsSync(state.file)) fs.unlinkSync(state.file);
                    } catch (_rollbackFailed) {
                        throw Object.assign(new Error("Previous settings could not be restored"), { code: "CFW_PROFILE_DIRECTORY_ROLLBACK_FAILED" });
                    }
                }
                prepared = null; state.release();
                throw error;
            }
            try { stopWatchers(sender); } catch (_closed) { /* Exit cleanup also closes watchers. */ }
            // Keep the write barrier until the old process has quit, including
            // late input blur events and already queued repository messages.
            schedule(() => { app.isQuiting = true; app.quit(); });
            return { restarting: true };
        }
    };
}
module.exports = { createProfileDirectoryRestart };
