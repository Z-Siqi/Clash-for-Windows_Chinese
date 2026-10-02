"use strict";

const { parsePort } = require("../../core/network/tcp-port");
const { isTcpPortAvailable } = require("../../core/network/mixed-port-recovery");

function registerPortIpc({ ipcMain, getMainWindow, net, getPort }) {
    let pending = 0;
    ipcMain.handle("loopback-port", async (event, operation, port) => {
        const owner = getMainWindow()?.webContents;
        if (!owner || event.sender !== owner || event.senderFrame !== owner.mainFrame) throw new Error("Invalid port request sender");
        if (!["available", "random"].includes(operation) || pending >= 16) throw new Error("Port operation is unavailable");
        if (operation === "available" && parsePort(port) === null) throw new Error("Invalid TCP port");
        pending++;
        try {
            return operation === "random" ? await getPort({ host: "127.0.0.1" })
                : await isTcpPortAvailable({ net, port, host: "127.0.0.1" });
        } catch { throw new Error("Loopback port check failed"); }
        finally { pending--; }
    });
}

module.exports = { registerPortIpc };
