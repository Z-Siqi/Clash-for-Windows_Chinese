"use strict";

const SERVICE_BASE_URL = "http://127.0.0.1:53000";

function createClashServiceApi({ client }) {
    return {
        ping(timeout = 500) {
            return client.get(`${SERVICE_BASE_URL}/ping`, { timeout });
        },
        start(payload) {
            return client.post(`${SERVICE_BASE_URL}/start`, payload, {
                validateStatus: () => true,
                timeout: 4000
            });
        },
        stop() {
            return client.get(`${SERVICE_BASE_URL}/stop`, { timeout: 2500 });
        },
        shutdown() {
            return client.get(`${SERVICE_BASE_URL}/shutdown`, { timeout: 2500 });
        },
        systemProxy(path, args) {
            return client.post(`${SERVICE_BASE_URL}/system-proxy`, { path, args }, {
                validateStatus: () => true,
                timeout: 16000
            });
        }
    };
}

module.exports = { SERVICE_BASE_URL, createClashServiceApi };
