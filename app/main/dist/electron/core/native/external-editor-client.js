"use strict";

function createExternalEditorClient({ ipcRenderer, getHome }) {
    return {
        edit: (language, content) => ipcRenderer.invoke("external-editor", "edit", { home: getHome(), language, content }),
        cancel: () => ipcRenderer.invoke("external-editor", "cancel").catch(() => {})
    };
}

module.exports = { createExternalEditorClient };
