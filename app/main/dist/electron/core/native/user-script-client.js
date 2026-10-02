"use strict";

const PROFILE_SCRIPT = Symbol("profile-script");
const PROXY_SCRIPT = Symbol("proxy-script");

function createUserScriptClient({ ipcRenderer, getHome, onError }) {
    return {
        async run(payload, type) {
            const scriptType = type === PROFILE_SCRIPT ? "profile" : type === PROXY_SCRIPT ? "proxy" : null;
            if (!scriptType) return;
            try { await ipcRenderer.invoke("user-script", { home: getHome(), scriptType, payload }); }
            catch (_error) { onError(); }
        }
    };
}

module.exports = { createUserScriptClient, PROFILE_SCRIPT, PROXY_SCRIPT };
