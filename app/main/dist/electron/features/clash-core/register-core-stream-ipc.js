"use strict";

const { createWebSocketFactory } = require("../../core/network/clash-clients");

function registerCoreStreamIpc({ ipcMain, getMainWindow, getConnectionInfo, WebSocket }) {
    const streams = new Map();
    let observedWindow;
    function closeAll() {
        for (const stream of streams.values()) stream.terminate();
        streams.clear();
    }
    ipcMain.handle("clash-stream", (event, operation, request = {}) => {
        const window = getMainWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
            throw new Error("Controller stream request did not originate from the dashboard main frame");
        }
        if (!Number.isSafeInteger(request.id) || request.id <= 0) throw new Error("Invalid controller stream identity");
        if (operation === "stop") {
            streams.get(request.id)?.terminate();
            streams.delete(request.id);
            return;
        }
        if (operation !== "start" || !["traffic", "connections", "logs"].includes(request.endpoint)) throw new Error("Unsupported controller stream");
        if (streams.has(request.id) || streams.size >= 32) throw new Error("Controller stream limit exceeded");
        const query = request.query || [];
        if (!Array.isArray(query) || query.length > 2 || query.some(value =>
            request.endpoint !== "logs" || !["level=info", "level=debug", "level=warning", "level=error", "level=silent", "format=structured"].includes(value)
        )) throw new Error("Unsupported controller stream options");
        const info = getConnectionInfo();
        if (!info) throw new Error("Clash Core is not ready");
        if (observedWindow !== event.sender) {
            closeAll();
            observedWindow = event.sender;
            observedWindow.once("destroyed", closeAll);
            observedWindow.on("render-process-gone", closeAll);
            observedWindow.on("did-start-loading", closeAll);
        }
        const socket = createWebSocketFactory({ WebSocket, ...info })(request.endpoint, query);
        streams.set(request.id, socket);
        function publish(type, value) {
            if (!event.sender.isDestroyed()) event.sender.send("clash-stream-event", { id: request.id, type, value });
        }
        socket.on("message", payload => publish("message", payload.toString()));
        socket.on("open", () => publish("open"));
        socket.on("error", () => publish("error", "Controller stream unavailable"));
        socket.on("close", () => {
            if (streams.get(request.id) === socket) streams.delete(request.id);
            publish("close");
        });
    });
}

module.exports = { registerCoreStreamIpc };
