"use strict";

const { CLASH_API_OPERATIONS } = require("../../core/network/clash-api-contract");

function registerClashApiIpc({ ipcMain, getMainWindow, clashApi, onConfigApplied, activity }) {
    const sessions = new WeakMap();
    function sessionFor(sender) {
        if (!sessions.has(sender)) {
            const session = { generation: 0, requests: new Map(), applying: Promise.resolve() };
            const retire = () => {
                session.generation++;
                for (const request of session.requests.values()) {
                    // An accepted PUT may still be applying inside the core.
                    // Let it settle before the new page's PUT, but suppress its callback.
                    if (request.operation !== "putConfig") request.abort.abort();
                }
                session.requests.clear();
            };
            sender.on?.("did-start-loading", retire);
            sender.once?.("destroyed", retire);
            sessions.set(sender, session);
        }
        return sessions.get(sender);
    }
    function authorized(event) {
        const window = getMainWindow();
        return window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
    }
    ipcMain.on("clash-api-cancel", (event, id) => {
        if (authorized(event)) sessionFor(event.sender).requests.get(id)?.abort.abort();
    });
    ipcMain.handle("clash-api", async (event, operation, request = {}) => {
        if (!authorized(event)) throw new Error("Controller request did not originate from the dashboard main frame");
        if (!Object.hasOwn(CLASH_API_OPERATIONS, operation)) throw new Error("Unsupported controller operation");
        const [count, optionIndex] = CLASH_API_OPERATIONS[operation];
        const session = sessionFor(event.sender), generation = session.generation;
        if (!Number.isSafeInteger(request.id) || request.id <= 0 || session.requests.has(request.id)) throw new Error("Invalid controller request identity");
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
        // Cold provider downloads need a generous bound, including an old page's
        // accepted write that a replacement page must wait behind.
        if (operation === "putConfig" && !(options.timeout > 0)) options.timeout = 300000;
        const args = request.args.slice();
        if (optionIndex >= 0) args[optionIndex] = options;
        if (operation === "testProxyDelay" && request.provider) args[2] = { name: String(request.provider.name) };
        const active = { abort, operation };
        session.requests.set(request.id, active);
        const current = () => generation === session.generation && !abort.signal.aborted;
        const canceled = () => { throw Object.assign(new Error("Obsolete controller request"), { code: "ERR_CANCELED" }); };
        let release;
        try {
            let response;
            if (operation === "putConfig") {
                release = activity?.begin();
                const apply = session.applying.catch(() => {}).then(() => {
                    if (!current()) return canceled();
                    return clashApi[operation](...args);
                });
                session.applying = apply.catch(() => {});
                response = await apply;
            } else response = await clashApi[operation](...args);
            if (!current()) return canceled();
            if (operation === "putConfig" && response.status === 204) onConfigApplied?.(args[0]);
            // Axios response/config objects contain transport handles and credentials.
            return { ok: true, value: { status: response.status, data: response.data } };
        } catch (error) {
            return { ok: false, error: {
                message: "Controller request failed", code: error.code,
                response: error.response ? { status: error.response.status, data: error.response.data } : undefined
            } };
        } finally {
            release?.();
            if (session.requests.get(request.id) === active) session.requests.delete(request.id);
        }
    });
}

module.exports = { registerClashApiIpc };
