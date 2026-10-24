"use strict";

function createExternalEditorClient({ ipcRenderer, getHome, activity }) {
    return {
        async edit(language, content) {
            const release = activity?.begin();
            try { return await ipcRenderer.invoke("external-editor", "edit", { home: getHome(), language, content }); }
            finally { release?.(); }
        },
        cancel: () => ipcRenderer.invoke("external-editor", "cancel").catch(() => {})
    };
}

module.exports = { createExternalEditorClient };
