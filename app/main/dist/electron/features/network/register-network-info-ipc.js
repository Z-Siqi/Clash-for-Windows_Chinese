"use strict";

const { detectDefaultInterface, listNetworkInterfaces } = require("./network-interfaces");
const { listWlanInterfaces } = require("./wlan-interfaces");

function registerNetworkInfoIpc({ ipcMain, getMainWindow, platform, networkInterfaces, execSync, isIP, isIPv4 }) {
    const operations = {
        interfaces: () => listNetworkInterfaces({ networkInterfaces }),
        addresses: networkInterfaces,
        defaultInterface: () => detectDefaultInterface({ platform, networkInterfaces, execSync, isIP, isIPv4 }),
        wlan: () => listWlanInterfaces({ platform, execSync })
    };
    // No renderer-supplied command or arguments reach the native route tools.
    ipcMain.handle("network-info", (event, operation) => {
        const window = getMainWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
            throw new Error("Network information request did not originate from the dashboard main frame");
        }
        if (!Object.hasOwn(operations, operation)) throw new Error("Unsupported network information operation");
        return operations[operation]();
    });
}

module.exports = { registerNetworkInfoIpc };
