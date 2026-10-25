"use strict";

function createPublicContentClient({ ipcRenderer }) {
    return {
        getUpdate: () => ipcRenderer.invoke("public-content", "update"),
        getAds: () => ipcRenderer.invoke("public-content", "ads"),
        getSnippets: section => ipcRenderer.invoke("public-content", "snippets", section)
    };
}

module.exports = { createPublicContentClient };
