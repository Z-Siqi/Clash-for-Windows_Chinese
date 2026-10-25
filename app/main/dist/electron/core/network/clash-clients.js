"use strict";

function parseControllerPort(externalController) {
    if (!externalController) return 0;
    const value = String(externalController).trim();
    const match = value.match(/:(\d+)$/);
    return match ? Number.parseInt(match[1], 10) || 0 : 0;
}

function createAxiosClient({ axios, controllerPort, secret = "" }) {
    if (controllerPort <= 0) return null;
    return axios.create({
        baseURL: `http://127.0.0.1:${controllerPort}/`,
        timeout: 5000,
        // Controller credentials must never follow environment proxies or redirects.
        proxy: false,
        maxRedirects: 0,
        headers: { Authorization: `Bearer ${secret}` }
    });
}

function createGotClient({ got, controllerPort, secret = "" }) {
    if (controllerPort <= 0) return null;
    return got.extend({
        baseUrl: `http://127.0.0.1:${controllerPort}`,
        cache: false,
        followRedirect: false,
        headers: { Authorization: `Bearer ${secret}` }
    });
}

function createWebSocketFactory({ WebSocket, controllerPort, secret = "" }) {
    return function createWebSocket(endpoint, query = []) {
        if (controllerPort <= 0) return null;
        const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        const querySuffix = query.length > 0 ? `&${query.join("&")}` : "";
        return new WebSocket(
            `ws://127.0.0.1:${controllerPort}${normalizedEndpoint}?token=${encodeURIComponent(secret)}${querySuffix}`
        );
    };
}

module.exports = {
    parseControllerPort,
    createAxiosClient,
    createGotClient,
    createWebSocketFactory
};
