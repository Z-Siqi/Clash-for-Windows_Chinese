"use strict";

function createNetworkInfoClient({ ipcRenderer }) {
    return Object.freeze({
        getNetworkInterfaces: () => ipcRenderer.invoke("network-info", "interfaces"),
        getNetworkAddresses: () => ipcRenderer.invoke("network-info", "addresses"),
        getDefaultInterface: () => ipcRenderer.invoke("network-info", "defaultInterface"),
        getWlanInterfaces: () => ipcRenderer.invoke("network-info", "wlan")
    });
}

module.exports = { createNetworkInfoClient };
