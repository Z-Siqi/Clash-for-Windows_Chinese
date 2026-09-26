"use strict";

function createNetworkSnapshot(networkInterfaces) {
    const interfaces = networkInterfaces() || {};
    return JSON.stringify(Object.keys(interfaces).sort().map(name => [
        name,
        (interfaces[name] || []).map(address => ({
            address: address.address,
            family: address.family,
            internal: address.internal,
            mac: address.mac,
            netmask: address.netmask,
            scopeid: address.scopeid
        })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    ]));
}

function createNetworkChangeMonitor({
    networkInterfaces,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    intervalMs = 2000
}) {
    // Poll only after the renderer requests SSID tracking. This replaces the
    // opaque native addon with a small cross-platform Node implementation.
    const listeners = new Set();
    let timer = null;
    let previousSnapshot = null;

    function poll() {
        try {
            const snapshot = createNetworkSnapshot(networkInterfaces);
            if (previousSnapshot !== null && snapshot !== previousSnapshot) {
                for (const listener of listeners) {
                    listener(null, { type: "network", code: "network_interfaces_changed" });
                }
            }
            previousSnapshot = snapshot;
        } catch (error) {
            for (const listener of listeners) listener(error);
        }
    }

    function start() {
        if (timer !== null) return;
        poll();
        timer = setIntervalFn(poll, intervalMs);
        if (timer && typeof timer.unref === "function") timer.unref();
    }

    function subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("Network change listener must be a function");
        listeners.add(listener);
        start();
        return function unsubscribe() {
            listeners.delete(listener);
            if (listeners.size === 0) stop();
        };
    }

    function stop() {
        if (timer !== null) clearIntervalFn(timer);
        timer = null;
        previousSnapshot = null;
    }

    return { subscribe, poll, stop };
}

module.exports = { createNetworkSnapshot, createNetworkChangeMonitor };
