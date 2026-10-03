"use strict";

const SERVICE_BASE_URL = "http://127.0.0.1:53000";

function createClashServiceApi({ client, getCredentials }) {
    let activeHome;
    function options(extra = {}, home = activeHome) {
        const credentials = getCredentials?.(home);
        if (!credentials || !/^[a-f0-9]{64}$/.test(credentials.token)) throw new Error("Service credentials are unavailable; reinstall Service Mode");
        activeHome = credentials.dataDirectory;
        return { ...extra, proxy: false, headers: { Authorization: `Bearer ${credentials.token}` } };
    }
    return {
        async ping(timeout = 500) {
            const response = await client.get(`${SERVICE_BASE_URL}/ping`, options({ timeout }));
            // Legacy unauthenticated helpers also answer ping. Their success
            // must not select Service Mode with an incompatible start schema.
            if (response.headers?.["x-cfw-service-protocol"] !== "2") {
                const error = new Error("Service Mode helper requires an update");
                error.code = "CFW_SERVICE_UPDATE_REQUIRED";
                throw error;
            }
            return response;
        },
        async start(payload) {
            const core = String(payload.path).split(/[\\/]/).pop();
            return client.post(`${SERVICE_BASE_URL}/start`, { core, silent: payload.silent === true }, options({
                validateStatus: () => true,
                timeout: 4000
            }, payload.cwd));
        },
        async stop() {
            return client.post(`${SERVICE_BASE_URL}/stop`, null, options({ timeout: 2500 }));
        },
        async shutdown() {
            return client.post(`${SERVICE_BASE_URL}/shutdown`, null, options({ timeout: 2500 }));
        },
        async shutdownLegacy() {
            // Migration only: never start an old helper or send it credentials.
            // New authenticated helpers reject this probe and cannot enter the
            // legacy GET shutdown path.
            const probe = await client.get(`${SERVICE_BASE_URL}/ping`, { proxy: false, timeout: 500, validateStatus: () => true });
            if (probe.status !== 200 || probe.headers?.["x-cfw-service-protocol"]) return false;
            const response = await client.get(`${SERVICE_BASE_URL}/shutdown`, { proxy: false, timeout: 2500 });
            return response.status === 200;
        },
        async systemProxy(path, args) {
            return client.post(`${SERVICE_BASE_URL}/system-proxy`, { args }, options({
                validateStatus: () => true,
                timeout: 16000
            }));
        }
    };
}

module.exports = { SERVICE_BASE_URL, createClashServiceApi };
