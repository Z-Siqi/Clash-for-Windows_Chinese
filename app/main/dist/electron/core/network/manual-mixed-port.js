"use strict";

const { parsePort } = require("./tcp-port");
const { applyAndVerifyMixedPort } = require("./mixed-port-recovery");

async function readPort(clashApi) {
    const response = await clashApi.getConfig({ timeout: 1000 });
    const port = response.data?.["mixed-port"];
    if (response.status !== 200 || (port !== 0 && parsePort(port) === null)) throw new Error("Core port is unavailable");
    return port;
}

function failure(reason, actualPort) {
    return Object.assign(new Error(reason), { reason, actualPort });
}

async function setManualMixedPort({ clashApi, port, checkAvailable, persist, sleep }) {
    if (parsePort(port) === null) throw failure("unavailable");
    const previous = await readPort(clashApi);
    // Choosing the actual current port still makes a random startup port fixed.
    // Do not probe or rebind our own listener, even if the page display is stale.
    if (port === previous) {
        try { await persist(port); } catch { throw failure("persist", previous); }
        return port;
    }
    if (await checkAvailable(port) === false) throw failure("unavailable", previous);
    let reason = "apply";
    try {
        if (!await applyAndVerifyMixedPort({ clashApi, port, sleep })) throw failure(reason);
        reason = "persist";
        await persist(port);
        return port;
    } catch (_error) {
        // A transport error may arrive after the core changed listeners.
        let actual = await readPort(clashApi).catch(() => undefined);
        if (actual !== previous) {
            try {
                const response = await clashApi.patchConfig({ "mixed-port": previous });
                if (response.status === 204) actual = await readPort(clashApi);
            } catch { actual = await readPort(clashApi).catch(() => undefined); }
        }
        throw failure(actual === previous ? reason : "rollback", actual);
    }
}

module.exports = { setManualMixedPort };
