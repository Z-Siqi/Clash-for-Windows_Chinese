"use strict";

const { parsePort } = require("../../core/network/tcp-port");
const { isTcpPortAvailable } = require("../../core/network/mixed-port-recovery");
const { isMixedPortAvailable } = require("../../core/network/mixed-port-availability");

function registerPortIpc({ ipcMain, getMainWindow, net, dgram, getPort, clashApi, permissionMayDiffer = false }) {
    let pending = 0;
    ipcMain.handle("loopback-port", async (event, operation, port) => {
        const owner = getMainWindow()?.webContents;
        if (!owner || event.sender !== owner || event.senderFrame !== owner.mainFrame) throw new Error("Invalid port request sender");
        if (!["available", "mixed-available", "random"].includes(operation) || pending >= 16) throw new Error("Port operation is unavailable");
        if (operation !== "random" && parsePort(port) === null) throw new Error("Invalid TCP port");
        pending++;
        try {
            if (operation === "mixed-available") {
                // The renderer supplies only a port. Bind scope comes from the
                // authenticated core, never an arbitrary renderer socket target.
                const response = await clashApi.getConfig({ timeout: 1000 });
                if (response.status !== 200 || !response.data) throw new Error("Core configuration unavailable");
                return await isMixedPortAvailable({ net, dgram, port, config: response.data, permissionMayDiffer });
            }
            return operation === "random" ? await getPort({ host: "127.0.0.1" })
                : await isTcpPortAvailable({ net, port, host: "127.0.0.1" });
        } catch { throw new Error("Loopback port check failed"); }
        finally { pending--; }
    });
}

module.exports = { registerPortIpc };
