"use strict";

const { parsePort } = require("./tcp-port");

function isTcpPortAvailable({ net, port, host }) {
    const normalizedPort = parsePort(port);
    if (normalizedPort === null) return Promise.resolve(false);
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        const finish = value => {
            server.removeAllListeners();
            resolve(value);
        };
        server.once("error", error => {
            if (["EADDRINUSE", "EACCES"].includes(error.code)) finish(false);
            else reject(error);
        });
        server.once("listening", () => server.close(error => error ? reject(error) : finish(true)));
        server.listen({ port: normalizedPort, host, exclusive: true });
    });
}

async function findAvailableTcpPort({ getPort, net, excluded = new Set(), attempts = 20 }) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const candidate = parsePort(await getPort());
        if (candidate === null || excluded.has(candidate)) continue;
        if (await isTcpPortAvailable({ net, port: candidate })) return candidate;
        excluded.add(candidate);
    }
    throw new Error("Could not find an available TCP port");
}

async function applyAndVerifyMixedPort({ clashApi, port, sleep, attempts = 5 }) {
    const normalizedPort = parsePort(port);
    if (normalizedPort === null) return false;
    const response = await clashApi.patchConfig({ "mixed-port": normalizedPort }).catch(() => null);
    if (!response || response.status !== 204) return false;
    // Availability checks are inherently racy, so accept the port only after
    // the core itself reports that it activated the requested listener.
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (attempt > 0) await sleep(100);
        const config = await clashApi.getConfig({ timeout: 1000 }).catch(() => null);
        if (config && config.status === 200 && parsePort(config.data && config.data["mixed-port"]) === normalizedPort) {
            return true;
        }
    }
    return false;
}

async function confirmMixedPortConflict({ clashApi, sleep, attempts = 3, delay = 150 }) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (attempt > 0) await sleep(delay);
        const response = await clashApi.getConfig({ timeout: 1000 }).catch(() => null);
        if (!response || response.status !== 200 || response.data?.["mixed-port"] !== 0) return false;
    }
    return true;
}

async function recoverWithRandomPort({ getPort, net, clashApi, sleep, attempts = 10 }) {
    const excluded = new Set();
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const port = await findAvailableTcpPort({ getPort, net, excluded });
        if (await applyAndVerifyMixedPort({ clashApi, port, sleep })) return port;
        excluded.add(port);
    }
    throw new Error("Could not activate an available mixed port");
}

module.exports = {
    isTcpPortAvailable,
    findAvailableTcpPort,
    applyAndVerifyMixedPort,
    confirmMixedPortConflict,
    recoverWithRandomPort
};
