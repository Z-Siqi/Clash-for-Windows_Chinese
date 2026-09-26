"use strict";

function createClashApi({ getClient }) {
    const request = (method, url, ...args) => {
        const client = getClient();
        if (!client) return Promise.reject(new Error("Clash Core is not ready"));
        return client[method](url, ...args);
    };

    return {
        isReady() {
            return Boolean(getClient());
        },
        getConfig(options) {
            return request("get", "/configs", options);
        },
        patchConfig(config, options) {
            return request("patch", "/configs", config, options);
        },
        putConfig(config, options) {
            return request("put", "/configs", config, options);
        },
        getProxies(options) {
            return request("get", "/proxies", options);
        },
        getProxyProviders(options) {
            return request("get", "/providers/proxies", options);
        },
        getRuleProviders(options) {
            return request("get", "/providers/rules", options);
        },
        getRules(options) {
            return request("get", "/rules", options);
        },
        getConnections(options) {
            return request("get", "/connections", options);
        },
        getVersion(options) {
            return request("get", "/version", options);
        },
        selectProxy(groupName, proxyName) {
            return request("put", `/proxies/${encodeURIComponent(groupName)}`, { name: proxyName });
        },
        closeConnections() {
            return request("delete", "/connections");
        },
        closeConnection(id, options) {
            return request("delete", `/connections/${encodeURIComponent(id)}`, options);
        },
        updateProxyProvider(name, options) {
            return request("put", `/providers/proxies/${encodeURIComponent(name)}`, {}, options);
        },
        updateRuleProvider(name, options) {
            return request("put", `/providers/rules/${encodeURIComponent(name)}`, {}, options);
        },
        healthCheckProxyProvider(name, options) {
            return request("get", `/providers/proxies/${encodeURIComponent(name)}/healthcheck`, options);
        },
        getProvider(type, name, options) {
            return request("get", `/providers/${type}/${encodeURIComponent(name)}`, options);
        },
        testProxyDelay(name, options, provider) {
            if (provider) {
                return request(
                    "get",
                    `/providers/proxies/${encodeURIComponent(provider.name)}/${encodeURIComponent(name)}/healthcheck`,
                    options
                );
            }
            return request("get", `/proxies/${encodeURIComponent(name)}/delay`, options);
        },
        testProviderProxyDelay(provider, name, options) {
            return request(
                "get",
                `/providers/proxies/${encodeURIComponent(provider)}/${encodeURIComponent(name)}/healthcheck`,
                options
            );
        },
        queryDns(name, type) {
            return request("get", "/dns/query", { params: { name, type } });
        },
        flushFakeIpCache(options) {
            return request("post", "/cache/fakeip/flush", {}, options);
        },
        runScript(payload, options) {
            return request("post", "/script", payload, options);
        }
    };
}

module.exports = { createClashApi };
