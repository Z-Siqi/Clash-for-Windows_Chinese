"use strict";

const { CLASH_API_OPERATIONS } = require("../network/clash-api-contract");

function createClashApiClient({ ipcRenderer, isReady, onRequestChange = () => {} }) {
    let sequence = Date.now() * 1000;
    const operations = Object.fromEntries(Object.entries(CLASH_API_OPERATIONS).map(([operation, [count, optionIndex]]) => [operation, async (...values) => {
        if (!isReady()) throw new Error("Clash Core is not ready");
        const id = ++sequence;
        const options = optionIndex >= 0 ? values[optionIndex] || {} : {};
        const cancel = () => ipcRenderer.send("clash-api-cancel", id);
        options.cancelToken?.throwIfRequested();
        if (options.signal?.aborted) throw Object.assign(new Error("Controller request canceled"), { code: "ERR_CANCELED", __CANCEL__: true });
        options.signal?.addEventListener("abort", cancel, { once: true });
        options.cancelToken?.promise.then(cancel);
        onRequestChange(1);
        try {
            const request = {
                id, args: values.slice(0, count),
                options: { timeout: options.timeout, params: options.params, acceptAllStatus: typeof options.validateStatus === "function" }
            };
            if (operation === "testProxyDelay" && values[2]) request.provider = { name: values[2].name };
            const result = await ipcRenderer.invoke("clash-api", operation, request);
            if (!result.ok) {
                const error = Object.assign(new Error(result.error.message), result.error);
                if (error.code === "ERR_CANCELED") error.__CANCEL__ = true;
                throw error;
            }
            return result.value;
        } finally {
            options.signal?.removeEventListener("abort", cancel);
            onRequestChange(-1);
        }
    }]));
    return Object.freeze({ isReady, ...operations });
}

module.exports = { createClashApiClient };
