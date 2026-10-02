"use strict";

function createProfileDownloadClient({ ipcRenderer, store, getLanguage }) {
    let sequence = Date.now() * 1000;
    let active = 0;
    const waiting = [];
    async function acquire() {
        if (active < 4) active++;
        else await new Promise(resolve => waiting.push(resolve));
    }
    function release() {
        const next = waiting.shift();
        if (next) next();
        else active--;
    }
    return {
        async downloadProfile({ url, headersString = "", cancelToken }) {
            const id = ++sequence;
            let finished = false;
            let started = false;
            let cancelled = false;
            cancelToken?.promise?.then(() => {
                cancelled = true;
                if (started && !finished) ipcRenderer.send("profile-download-cancel", id);
            });
            await acquire();
            try {
                if (cancelled) throw new Error("Profile download cancelled");
                started = true;
                const { result, mutations } = await ipcRenderer.invoke("profile-download", {
                    id, url, headersString, home: store.state.app.clashPath, language: getLanguage()
                });
                for (const { type, payload } of mutations) {
                    if (!["APPEND_PROFILE", "CHANGE_PROFILE"].includes(type) || !payload?.profile) continue;
                    const files = store.state.app.profiles.files || [];
                    const index = files.findIndex(profile => profile.time === payload.profile.time || profile.url === payload.profile.url);
                    if (index >= 0) store.commit("CHANGE_PROFILE", { index, profile: { ...payload.profile, time: files[index].time } });
                    else if (type === "APPEND_PROFILE") store.commit(type, payload);
                }
                if (result.success) result.targetIndex = store.state.app.profiles.files.findIndex(profile => profile.url === url);
                return result;
            } catch (_error) {
                return { success: false, message: "Profile download failed or was cancelled" };
            } finally { finished = true; release(); }
        }
    };
}

module.exports = { createProfileDownloadClient };
