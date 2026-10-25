"use strict";

function createDhcpClient({ ipcRenderer }) {
    let listener;
    ipcRenderer.on("dhcp-event", (_event, message) => listener?.(message.type, message.value));
    return {
        async start(request, onEvent) {
            listener = onEvent;
            try { await ipcRenderer.invoke("dhcp", "start", request); }
            catch (error) { listener = undefined; throw error; }
        },
        async stop() { await ipcRenderer.invoke("dhcp", "stop"); listener = undefined; },
        updatePolicy(request) { return ipcRenderer.invoke("dhcp", "policy", request); }
    };
}

module.exports = { createDhcpClient };
