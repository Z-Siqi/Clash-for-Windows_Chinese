"use strict";

function createProfileDirectoryClient({ ipcRenderer, getHome, activity }) {
    const preparations = new Map();
    const request = async (operation, data) => {
        const result = await ipcRenderer.invoke("profile-directory", operation, { home: getHome(), ...data });
        if (!result.ok) throw Object.assign(new Error("Profile directory change failed"), { code: result.code });
        return result.value;
    };
    return {
        isBusy: () => activity.isBusy(),
        async prepare(directory, reset = false) {
            const release = activity.freeze();
            try {
                const value = await request("prepare", { directory, reset });
                if (value.unchanged) release();
                else preparations.set(value.token, release);
                return value;
            } catch (error) { release(); throw error; }
        },
        commit: token => request("commit", { token }),
        async cancel(token) {
            try { return await request("cancel", { token }); }
            finally { preparations.get(token)?.(); preparations.delete(token); }
        }
    };
}
module.exports = { createProfileDirectoryClient };
