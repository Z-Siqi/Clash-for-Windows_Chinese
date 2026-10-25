"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const axios = require("../../main/node_modules/axios/dist/node/axios.cjs");
const yaml = require("../../main/node_modules/yaml");
const { Console } = require("node:console");
const { createProfileParser } = require("../../main/dist/electron/features/profiles/profile-parser");
const { createAxiosClient } = require("../../main/dist/electron/core/network/clash-clients");

async function serve(t, handler) {
    const server = http.createServer(handler);
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    t.after(() => new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections?.();
    }));
    return server.address().port;
}

test("controller authentication stays on loopback when proxy environment variables are set", async t => {
    let proxyRequests = 0;
    let controllerRequests = 0;
    const proxyPort = await serve(t, (_request, response) => {
        proxyRequests += 1;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ controller: false }));
    });
    const controllerPort = await serve(t, (request, response) => {
        controllerRequests += 1;
        assert.equal(/^Bearer [a-f0-9]{64}$/.test(request.headers.authorization || ""), true);
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ controller: true }));
    });
    // A child owns the hostile environment; the test never changes the user's proxy settings.
    const source = `
        const { createAxiosClient } = require("./app/main/dist/electron/core/network/clash-clients");
        const axios = require("./app/main/node_modules/axios/dist/node/axios.cjs");
        const client = createAxiosClient({ axios, controllerPort: ${controllerPort},
            secret: require("node:crypto").randomBytes(32).toString("hex") });
        client.get("/version").then(response => {
            process.stdout.write(JSON.stringify({ controller: response.data.controller }));
        }).catch(() => { process.exitCode = 1; });
    `;
    const proxy = `http://127.0.0.1:${proxyPort}`;
    const { stdout } = await promisify(execFile)(process.execPath, ["-e", source], {
        cwd: path.resolve(__dirname, "../../.."), windowsHide: true, timeout: 10000,
        env: { ...process.env, HTTP_PROXY: proxy, http_proxy: proxy, HTTPS_PROXY: proxy,
            https_proxy: proxy, ALL_PROXY: proxy, all_proxy: proxy, NO_PROXY: "", no_proxy: "" }
    });
    assert.equal(proxyRequests, 0, "controller requests must never reach the environment proxy");
    assert.equal(controllerRequests, 1);
    assert.equal(JSON.parse(stdout).controller, true);
});

test("controller redirects cannot send authenticated requests to another listener", async t => {
    let redirectedRequests = 0;
    const targetPort = await serve(t, (_request, response) => {
        redirectedRequests += 1;
        response.end("unexpected redirect");
    });
    const controllerPort = await serve(t, (_request, response) => {
        response.writeHead(302, { Location: `http://127.0.0.1:${targetPort}/` });
        response.end();
    });
    const client = createAxiosClient({ axios, controllerPort,
        secret: require("node:crypto").randomBytes(32).toString("hex") });
    await assert.rejects(client.get("/version"), error => error.response?.status === 302);
    assert.equal(redirectedRequests, 0);
});

test("compressed subscription responses are bounded before parsing or writing profiles", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-profile-network-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const compressed = zlib.gzipSync(Buffer.alloc(16 * 1024 * 1024 + 1, " "));
    const port = await serve(t, (_request, response) => {
        response.writeHead(200, { "Content-Encoding": "gzip", "Content-Length": compressed.length });
        response.end(compressed);
    });
    const mutations = [];
    const store = {
        state: { app: { settings: {}, confData: {}, profiles: { files: [] },
            clashPath: directory, profilesPath: directory } },
        dispatch: async () => path.join(directory, "parser.log"),
        commit: (...args) => mutations.push(args)
    };
    const parser = createProfileParser({
        store, axios: axios.create({ proxy: false }), fs, path, yaml, Console,
        getLanguage: () => ({ downloadProfile: () => "Download", failedWithError: () => " failed: ",
            unknowErr: () => "Unknown error" }),
        parseContentDisposition: () => null
    });
    const result = await parser.downloadProfile({ url: `http://127.0.0.1:${port}/profile.yaml` });
    assert.equal(result.success, false);
    assert.match(result.message, /maxContentLength|too large|size limit/i);
    assert.equal(mutations.length, 0);
    assert.deepEqual(fs.readdirSync(directory), []);
    store.state.app.settings.profileDownloadExceptionsText = yaml.stringify({ exceptions: [{
        url: `http://127.0.0.1:${port}/profile.yaml`, maxSizeMiB: 32, timeoutSeconds: 180, processingTimeoutSeconds: 600
    }] });
    const allowed = await parser.downloadProfile({ url: `http://127.0.0.1:${port}/profile.yaml` });
    assert.equal(allowed.success, true, allowed.message);
    assert.equal(mutations.length, 1);
    const unlisted = await parser.downloadProfile({ url: `http://127.0.0.1:${port}/profile.yaml?other=1` });
    assert.equal(unlisted.success, false);
    assert.equal(mutations.length, 1);
});
