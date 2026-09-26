"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const axios = require("../../main/node_modules/axios");
const { configureRendererTransports } = require("../../main/dist/electron/entry/renderer/configure-transports");
const { createAxiosClient } = require("../../main/dist/electron/core/network/clash-clients");
const { createClashApi } = require("../../main/dist/electron/core/network/clash-api");

test("isolated renderer uses Axios Node transport for core and profile requests", async t => {
    const previousAdapter = axios.defaults.adapter;
    t.after(() => { axios.defaults.adapter = previousAdapter; });
    configureRendererTransports({ axios });
    assert.equal(axios.defaults.adapter, "http");

    const requests = [];
    const server = http.createServer((request, response) => {
        const chunks = [];
        request.on("data", chunk => chunks.push(chunk));
        request.on("end", () => {
            requests.push({
                method: request.method,
                url: request.url,
                origin: request.headers.origin,
                body: Buffer.concat(chunks).toString("utf8")
            });
            if (request.method === "PATCH" && request.url === "/configs") {
                response.writeHead(204);
                response.end();
                return;
            }
            response.writeHead(200, { "content-type": "text/yaml" });
            response.end("proxies: []\n");
        });
    });
    t.after(() => server.close());
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    const client = createAxiosClient({ axios, controllerPort: port });
    const api = createClashApi({ getClient: () => client });
    const modeResponse = await api.patchConfig({ mode: "script" });
    assert.equal(modeResponse.status, 204);

    const response = await axios.get(`http://127.0.0.1:${port}/profile.yaml`, {
        responseType: "text",
        transformResponse: [value => value]
    });
    assert.equal(response.data, "proxies: []\n");
    assert.deepEqual(requests, [
        { method: "PATCH", url: "/configs", origin: undefined, body: '{"mode":"script"}' },
        { method: "GET", url: "/profile.yaml", origin: undefined, body: "" }
    ]);
});
