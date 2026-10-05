"use strict";

const refreshes = new WeakMap();

function trackProfileRefresh(api, promise) {
    // Register before the queued apply starts, including refreshes queued behind it.
    refreshes.set(api, promise.catch(() => {}));
}

async function readStableProfileState(api, read) {
    for (;;) {
        const refresh = refreshes.get(api);
        if (refresh) await refresh;
        if (refresh !== refreshes.get(api)) continue;
        const value = await read();
        // A reload may start while controller responses are in flight.
        if (refresh === refreshes.get(api)) return value;
    }
}

module.exports = { trackProfileRefresh, readStableProfileState };
