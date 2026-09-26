"use strict";

// Capture before disabling a proxy, then close only that snapshot after success.
// A bulk DELETE would also kill connections established after the user turned it off.
async function prepareDisconnectCleanup({ api, settings = {}, disconnecting, onError = () => {} }) {
    const noop = async () => {};
    if (!disconnecting || settings.connProxyDisconnect === false || !api || !api.isReady()) return noop;
    let ids;
    try {
        const response = await api.getConnections({ timeout: 1000 });
        if (response.status !== 200 || !Array.isArray(response.data?.connections)) throw Error("Invalid snapshot");
        ids = [...new Set(response.data.connections.map(connection => connection?.id).filter(id => typeof id === "string" && id.length))];
    } catch (_error) {
        onError();
        return noop;
    }
    let consumed = false;
    return async success => {
        if (!success || consumed) return;
        consumed = true;
        let index = 0, failed = false;
        // Bound parallel controller requests even when many connections are present.
        await Promise.all(Array.from({ length: Math.min(8, ids.length) }, async () => {
            while (index < ids.length) {
                const id = ids[index++];
                try {
                    const response = await api.closeConnection(id, { timeout: 1000 });
                    if (![200, 204, 404].includes(response.status)) failed = true;
                } catch (error) {
                    if (error.response?.status !== 404) failed = true;
                }
            }
        }));
        // Do not expose HTTP errors: they can contain controller credentials.
        if (failed) onError();
    };
}

module.exports = { prepareDisconnectCleanup };
