"use strict";

// Positional argument counts and option positions for the semantic controller API.
const CLASH_API_OPERATIONS = Object.freeze({
    getConfig: [0, 0], patchConfig: [1, 1], putConfig: [1, 1],
    getProxies: [0, 0], getProxyProviders: [0, 0], getRuleProviders: [0, 0],
    getRules: [0, 0], getConnections: [0, 0], getVersion: [0, 0],
    selectProxy: [2, -1], closeConnections: [0, -1], closeConnection: [1, 1],
    updateProxyProvider: [1, 1], updateRuleProvider: [1, 1], healthCheckProxyProvider: [1, 1],
    getProvider: [2, 2], testProxyDelay: [1, 1], testProviderProxyDelay: [2, 2],
    queryDns: [2, -1], flushFakeIpCache: [0, 0], runScript: [1, 1]
});

module.exports = { CLASH_API_OPERATIONS };
