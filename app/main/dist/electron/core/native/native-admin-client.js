"use strict";

function createNativeAdminClient({ ipcRenderer, getBinaryPath, getClashPath, getFilesPath }) {
    const invoke = (scope, action, extra = {}) => ipcRenderer.invoke("native-admin", scope, action, {
        ...extra,
        clashPath: getClashPath(),
        filesPath: getFilesPath()
    });

    return {
        firewall: {
            status: () => invoke("firewall", "status", { binaryPath: getBinaryPath() }),
            add: () => invoke("firewall", "add", { binaryPath: getBinaryPath() }),
            remove: () => invoke("firewall", "remove", { binaryPath: getBinaryPath() })
        },
        service: {
            install: method => invoke("service", "install", { method }),
            uninstall: () => invoke("service", "uninstall"),
            update: () => invoke("service", "update")
        }
    };
}

module.exports = { createNativeAdminClient };
