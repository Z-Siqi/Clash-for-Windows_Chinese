"use strict";

function createClipboardClient(ipcRenderer) {
    return {
        readText() {
            return ipcRenderer.invoke("clipboard", "readText");
        },
        writeText(value) {
            return ipcRenderer.invoke("clipboard", "writeText", String(value));
        }
    };
}

module.exports = { createClipboardClient };
