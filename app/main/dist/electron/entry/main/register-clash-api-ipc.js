"use strict";

const { CLASH_API_OPERATIONS } = require("../../core/network/clash-api-contract");

function registerClashApiIpc({ ipcMain, getMainWindow, clashApi, onConfigApplied }) {
    const requests = new Map();
    function authorized(event) {
        const window = getMainWindow();
        return window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
    }
    ipcMain.on("clash-api-cancel", (event, id) => {
        if (authorized(event)) requests.get(id)?.abort();
    });
    ipcMain.handle("clash-api", async (event, operation, request = {}) => {
        if (!authorized(event)) throw new Error("Controller request did not originate from the dashboard main frame");
        if (!Object.hasOwn(CLASH_API_OPERATIONS, operation)) throw new Error("Unsupported controller operation");
        const [count, optionIndex] = CLASH_API_OPERATIONS[operation];
        if (!Number.isSafeInteger(request.id) || request.id <= 0 || requests.has(request.id)) throw new Error("Invalid controller request identity");
        if (!Array.isArray(request.args) || request.args.length !== count) throw new Error("Invalid controller operation arguments");
        if (operation === "getProvider" && !["rules", "proxies"].includes(request.args[0])) throw new Error("Unsupported provider type");
        const abort = new AbortController();
        const options = { signal: abort.signal };
        if (request.options?.timeout !== undefined) {
            if (!Number.isSafeInteger(request.options.timeout) || request.options.timeout < 0 || request.options.timeout > 300000) throw new Error("Invalid controller timeout");
            options.timeout = request.options.timeout;
        }
        if (request.options?.acceptAllStatus === true) options.validateStatus = () => true;
        if (request.options?.params) options.params = request.options.params;
        const args = request.args.slice();
        if (optionIndex >= 0) args[optionIndex] = options;
        if (operation === "testProxyDelay" && request.provider) args[2] = { name: String(request.provider.name) };
        requests.set(request.id, abort);
        try {
            const response = await clashApi[operation](...args);
            if (operation === "putConfig" && response.status === 204) onConfigApplied?.(args[0]);
            // Axios response/config objects contain transport handles and credentials.
            return { ok: true, value: { status: response.status, data: response.data } };
        } catch (error) {
            return { ok: false, error: {
                message: "Controller request failed", code: error.code,
                response: error.response ? { status: error.response.status, data: error.response.data } : undefined
            } };
        } finally { requests.delete(request.id); }
    });
}

module.exports = { registerClashApiIpc };
