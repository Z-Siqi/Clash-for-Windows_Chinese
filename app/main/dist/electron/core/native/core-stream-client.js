"use strict";

function createCoreStreamClient({ ipcRenderer, isReady, schedule = setTimeout, cancel = clearTimeout }) {
    let sequence = Date.now() * 1000;
    const streams = new Map();
    ipcRenderer.on("clash-stream-event", (_event, message) => {
        const stream = streams.get(message.id);
        if (!stream) return;
        if (message.type === "open") stream.readyState = 1;
        stream.emit(message.type, message.value);
        if (message.type === "close" || message.type === "error") stream.reconnect();
    });
    return function openStream(endpoint, query = []) {
        let id;
        let retryTimer;
        let stopped = false;
        const listeners = new Map();
        const stream = {
            readyState: 0,
            on(type, callback) {
                const callbacks = listeners.get(type) || [];
                callbacks.push(callback);
                listeners.set(type, callbacks);
                return stream;
            },
            emit(type, value) { for (const callback of listeners.get(type) || []) callback(value); },
            terminate() {
                stopped = true;
                stream.readyState = 3;
                if (retryTimer !== undefined) cancel(retryTimer);
                retryTimer = undefined;
                release();
            },
            reconnect() {
                if (stopped || retryTimer !== undefined) return;
                stream.readyState = 0;
                release();
                retryTimer = schedule(() => { retryTimer = undefined; connect(); }, 1000);
            },
            close() { stream.terminate(); }
        };
        function release() {
            if (id === undefined) return;
            streams.delete(id);
            ipcRenderer.invoke("clash-stream", "stop", { id }).catch(() => {});
            id = undefined;
        }
        function connect() {
            if (stopped) return;
            // Dashboard startup can precede publication of the controller credentials.
            if (!isReady()) { stream.reconnect(); return; }
            id = ++sequence;
            const attemptId = id;
            streams.set(id, stream);
            ipcRenderer.invoke("clash-stream", "start", { id, endpoint, query }).catch(() => {
                if (stopped || id !== attemptId) return;
                stream.emit("error", "Controller stream unavailable");
                stream.reconnect();
            });
        }
        connect();
        return stream;
    };
}

module.exports = { createCoreStreamClient };
