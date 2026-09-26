"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const { readRendererCompositionSource } = require("../fixtures/renderer-composition-source");
const {
    parseControllerPort,
    createAxiosClient,
    createGotClient,
    createWebSocketFactory
} = require(path.join(
    root,
    "app/main/dist/electron/core/network/clash-clients"
));
const { createClashApi } = require(path.join(
    root,
    "app/main/dist/electron/core/network/clash-api"
));
const { createClashServiceApi } = require(path.join(
    root,
    "app/main/dist/electron/core/network/clash-service-api"
));

assert.equal(parseControllerPort("127.0.0.1:9090"), 9090);
assert.equal(parseControllerPort("[::1]:9091"), 9091);
assert.equal(parseControllerPort("invalid"), 0);

let axiosConfig;
const axiosResult = createAxiosClient({
    axios: {
        create(config) {
            axiosConfig = config;
            return "axios-client";
        }
    },
    controllerPort: 9090,
    secret: "secret"
});
assert.equal(axiosResult, "axios-client");
assert.deepEqual(axiosConfig, {
    baseURL: "http://127.0.0.1:9090/",
    timeout: 5000,
    headers: { Authorization: "Bearer secret" }
});
assert.equal(
    createAxiosClient({ axios: {}, controllerPort: 0, secret: "" }),
    null
);

let gotConfig;
const gotResult = createGotClient({
    got: {
        extend(config) {
            gotConfig = config;
            return "got-client";
        }
    },
    controllerPort: 9091,
    secret: "got-secret"
});
assert.equal(gotResult, "got-client");
assert.deepEqual(gotConfig, {
    baseUrl: "http://127.0.0.1:9091",
    headers: { Authorization: "Bearer got-secret" }
});

class FakeWebSocket {
    constructor(url) {
        this.url = url;
    }
}
const createSocket = createWebSocketFactory({
    WebSocket: FakeWebSocket,
    controllerPort: 9092,
    secret: "ws-secret"
});
assert.equal(
    createSocket("traffic", ["interval=1000"]).url,
    "ws://127.0.0.1:9092/traffic?token=ws-secret&interval=1000"
);
assert.equal(
    createWebSocketFactory({ WebSocket: FakeWebSocket, controllerPort: 0, secret: "" })("logs"),
    null
);

const rendererSource = readRendererCompositionSource(root);
assert.match(
    rendererSource,
    /core\/network\/clash-clients/
);
assert.match(rendererSource, /core\/network\/clash-api/);



assert.equal(
    rendererSource.includes('baseURL: "http://127.0.0.1:".concat(i, "/")'),
    false,
    "renderer.js still owns the extracted Axios client construction"
);

assert.match(rendererSource, /createRendererAppModule\(\{/);
const requests = [];
const api = createClashApi({
    getClient: () => ({
        get: (...args) => { requests.push(["get", ...args]); return Promise.resolve({}); },
        patch: (...args) => { requests.push(["patch", ...args]); return Promise.resolve({}); },
        put: (...args) => { requests.push(["put", ...args]); return Promise.resolve({}); },
        delete: (...args) => { requests.push(["delete", ...args]); return Promise.resolve({}); },
        post: (...args) => { requests.push(["post", ...args]); return Promise.resolve({}); }
    })
});
Promise.all([
    api.getConfig(),
    api.patchConfig({ mode: "rule" }),
    api.putConfig({ payload: "config" }),
    api.getProxies(),
    api.getProxyProviders(),
    api.getRuleProviders(),
    api.getRules(),
    api.getConnections(),
    api.getVersion(),
    api.selectProxy("Auto Group", "Node A"),
    api.closeConnections(),
    api.closeConnection("connection/id"),
    api.updateProxyProvider("provider A"),
    api.updateRuleProvider("rules A"),
    api.healthCheckProxyProvider("provider A"),
    api.getProvider("rules", "rules A"),
    api.testProxyDelay("Node A", { timeout: 0 }),
    api.testProxyDelay("Node A", { timeout: 0 }, { name: "provider A" }),
    api.queryDns("example.com", "A"),
    api.flushFakeIpCache(),
    api.runScript({ script: "return config" })
]).then(() => {
    assert.deepEqual(requests, [
        ["get", "/configs", undefined],
        ["patch", "/configs", { mode: "rule" }, undefined],
        ["put", "/configs", { payload: "config" }, undefined],
        ["get", "/proxies", undefined],
        ["get", "/providers/proxies", undefined],
        ["get", "/providers/rules", undefined],
        ["get", "/rules", undefined],
        ["get", "/connections", undefined],
        ["get", "/version", undefined],
        ["put", "/proxies/Auto%20Group", { name: "Node A" }],
        ["delete", "/connections"],
        ["delete", "/connections/connection%2Fid", undefined],
        ["put", "/providers/proxies/provider%20A", {}, undefined],
        ["put", "/providers/rules/rules%20A", {}, undefined],
        ["get", "/providers/proxies/provider%20A/healthcheck", undefined],
        ["get", "/providers/rules/rules%20A", undefined],
        ["get", "/proxies/Node%20A/delay", { timeout: 0 }],
        ["get", "/providers/proxies/provider%20A/Node%20A/healthcheck", { timeout: 0 }],
        ["get", "/dns/query", { params: { name: "example.com", type: "A" } }],
        ["post", "/cache/fakeip/flush", {}, undefined],
        ["post", "/script", { script: "return config" }, undefined]
    ]);
    const serviceRequests = [];
    const serviceApi = createClashServiceApi({
        client: {
            get: (...args) => { serviceRequests.push(["get", ...args]); return Promise.resolve({}); },
            post: (...args) => { serviceRequests.push(["post", ...args]); return Promise.resolve({}); }
        }
    });
    return Promise.all([
        serviceApi.ping(275),
        serviceApi.start({ path: "clash" }),
        serviceApi.stop(),
        serviceApi.shutdown(),
        serviceApi.systemProxy("sysproxy", ["-show"])
    ]).then(() => {
        assert.deepEqual(serviceRequests.map(request => request.slice(0, 2)), [
            ["get", "http://127.0.0.1:53000/ping"],
            ["post", "http://127.0.0.1:53000/start"],
            ["get", "http://127.0.0.1:53000/stop"],
            ["get", "http://127.0.0.1:53000/shutdown"],
            ["post", "http://127.0.0.1:53000/system-proxy"]
        ]);
        assert.deepEqual(serviceRequests[0][2], { timeout: 275 });
        assert.equal(serviceRequests[1][3].timeout, 4000);
        assert.equal(serviceRequests[1][3].validateStatus(), true);
        assert.deepEqual(serviceRequests[2][2], { timeout: 2500 });
        assert.deepEqual(serviceRequests[3][2], { timeout: 2500 });
        assert.deepEqual(serviceRequests[4][2], { path: "sysproxy", args: ["-show"] });
        assert.equal(serviceRequests[4][3].timeout, 16000);
        assert.equal(serviceRequests[4][3].validateStatus(), true);
        console.log("renderer clients smoke: PASS");
    });
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
