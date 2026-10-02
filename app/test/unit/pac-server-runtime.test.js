"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const Koa = require("../../main/node_modules/koa");
const getPort = require("../../main/node_modules/get-port");
const { createPacServerRuntime } = require("../../main/dist/electron/features/network/pac-server-runtime");

function request(port, resource) {
    return new Promise((resolve, reject) => {
        http.get({ host: "127.0.0.1", port, path: resource }, response => {
            let body = "";
            response.on("data", chunk => { body += chunk; });
            response.on("end", () => resolve({ status: response.statusCode, body, type: response.headers["content-type"] }));
        }).on("error", reject);
    });
}

test("PAC runtime binds loopback, renders current persisted settings and closes the replaced listener", async t => {
    let server;
    class ObservedKoa extends Koa {
        listen(...args) { assert.equal(args[1], "127.0.0.1"); server = super.listen(...args); return server; }
    }
    let settings = { pacContentText: "PROXY 127.0.0.1:%mixed-port%" }, mixedPort = 7891;
    const runtime = createPacServerRuntime({ Koa: ObservedKoa, getPort, defaultPac: "DIRECT" });
    t.after(() => runtime.stop());
    const port = await runtime.start({ getSettings: () => settings, getMixedPort: () => mixedPort });
    assert.equal(server.address().address, "127.0.0.1");
    assert.deepEqual(await request(port, "/pac"), { status: 200, body: "PROXY 127.0.0.1:7891", type: "application/x-ns-proxy-autoconfig" });
    assert.equal((await request(port, "/other")).status, 404);
    mixedPort = 7892;
    assert.equal((await request(port, "/pac")).body, "PROXY 127.0.0.1:7892");
    const previous = server;
    settings = { innerServerPort: await getPort({ host: "127.0.0.1" }) };
    await runtime.start({ getSettings: () => settings, getMixedPort: () => mixedPort });
    assert.equal(previous.listening, false);
});
