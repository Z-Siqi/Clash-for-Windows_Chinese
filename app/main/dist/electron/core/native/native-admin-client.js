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
        systemProxy: {
            set: ({ enabled, mixedPort, innerServerPort }) => invoke("system-proxy", "set", { enabled, mixedPort, innerServerPort }),
            getStatus: () => invoke("system-proxy", "status")
        },
        dns: {
            query: () => invoke("dns", "query"),
            reset: () => invoke("dns", "reset"),
            set: addresses => invoke("dns", "set", { addresses })
        },
        profileNetworkEffects: {
            hasTap: () => invoke("profile-network", "has-tap"),
            renewDhcp: () => invoke("profile-network", "renew-dhcp")
        },
        terminal: {
            open: (selection, elevated, port) => invoke("terminal", "open", { selection, elevated, port }),
            loopback: () => invoke("terminal", "loopback")
        },
        tun: {
            setup: (install, tapInfo) => invoke("tun", "setup", { install, tapInfo }),
            start: (mixedPort, tapInfo) => invoke("tun", "start", { mixedPort, tapInfo }),
            stop: () => invoke("tun", "stop")
        },
        service: {
            status: () => invoke("service", "status"),
            needUpdate: () => invoke("service", "need-update"),
            install: method => invoke("service", "install", { method }),
            uninstall: () => invoke("service", "uninstall"),
            update: () => invoke("service", "update")
        }
    };
}

module.exports = { createNativeAdminClient };
