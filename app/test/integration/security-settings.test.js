"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const https = require("node:https");
const http = require("node:http");
const net = require("node:net");
const { Console } = require("node:console");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { randomUUID } = require("node:crypto");
const axios = require("../../main/node_modules/axios/dist/node/axios.cjs");
const yaml = require("../../main/node_modules/yaml");
const { HttpsProxyAgent } = require("../../main/node_modules/hpagent");
const { createProfileParser } = require("../../main/dist/electron/features/profiles/profile-parser");
const { homePage } = require("../fixtures/home-page");

// Public test-only key and self-signed certificate; never trusted by the OS.
const tls = Object.fromEntries(["key", "cert"].map(name => [name,
    fs.readFileSync(path.join(__dirname, "../fixtures/loopback-tls", `${name}.pem`))]));

async function listen(t, server) {
    const sockets = new Set();
    server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); for (const socket of sockets) socket.destroy(); }));
    return server.address().port;
}

async function connectProxy(t) {
    const proxy = http.createServer();
    proxy.on("connect", (request, socket, head) => {
        const destination = new URL(`http://${request.url}`);
        if (!["127.0.0.1", "localhost"].includes(destination.hostname)) { socket.destroy(); return; }
        const target = net.connect(Number(destination.port), "127.0.0.1", () => {
            socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
            target.write(head); socket.pipe(target); target.pipe(socket);
        });
        target.on("error", () => socket.destroy());
        socket.on("close", () => target.destroy());
        socket.on("error", () => target.destroy());
    });
    return listen(t, proxy);
}

function profile(t, settings, confData = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-security-settings-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return createProfileParser({
        store: { state: { app: { settings, confData, clashPath: directory, profilesPath: directory, profiles: { files: [] } } },
            dispatch: async () => path.join(directory, "parser.log"), commit() {} },
        axios: axios.create({ proxy: false }), fs, path, yaml, Console, HttpsProxyAgent,
        createProfileTime: () => `${randomUUID()}.yml`,
        parseContentDisposition: () => null,
        getLanguage: () => ({ downloadProfile: () => "Download", failedWithError: () => " failed: ", unknowErr: () => "Unknown" })
    });
}

for (const throughProxy of [false, true]) {
    test(`saved certificate exceptions reach subscription downloads (${throughProxy ? "CONNECT proxy" : "direct"})`, async t => {
        let received = 0;
        const port = await listen(t, https.createServer(tls, (request, response) => {
            received++;
            if (request.url.startsWith("/redirect")) {
                response.writeHead(302, { Location: request.url === "/redirect-listed" ? "/listed" : "/unlisted" }); response.end();
            }
            else response.end("proxies: []\nproxy-groups: []\nrules: []\n");
        }));
        const origin = `https://127.0.0.1:${port}`;
        const proxyPort = throughProxy ? await connectProxy(t) : undefined;
        const settings = { updateProfileThroughClashProxy: throughProxy };
        const parser = profile(t, settings, { "mixed-port": proxyPort });
        assert.equal((await parser.downloadProfile({ url: `${origin}/listed` })).success, false);
        assert.equal(received, 0);
        settings.unsafeURLsText = yaml.stringify({ urls: [`${origin}/listed`, `${origin}/redirect`, `${origin}/redirect-listed`] });
        const allowed = await parser.downloadProfile({ url: `${origin}/listed` });
        assert.equal(allowed.success, true, allowed.message);
        assert.equal((await parser.downloadProfile({ url: `${origin}/unlisted` })).success, false);
        assert.equal((await parser.downloadProfile({ url: `${origin}/listed?other=1` })).success, false);
        assert.equal((await parser.downloadProfile({ url: `${origin}/redirect` })).success, false);
        assert.equal(received, 2, "a redirect must not inherit the source URL's exception");
        const redirected = await parser.downloadProfile({ url: `${origin}/redirect-listed` });
        assert.equal(redirected.success, true, redirected.message);
        assert.equal(received, 4);
        const redirectPort = await listen(t, http.createServer((_request, response) => {
            response.writeHead(302, { Location: `${origin}/listed` }); response.end();
        }));
        // The explicit Clash proxy path is HTTPS-only; direct requests also cover HTTP→HTTPS redirects.
        if (!throughProxy) {
            const upgraded = await parser.downloadProfile({ url: `http://127.0.0.1:${redirectPort}/` });
            assert.equal(upgraded.success, true, upgraded.message);
        }
        settings.unsafeURLsText = "urls: []\n";
        assert.equal((await parser.downloadProfile({ url: `${origin}/listed` })).success, false);
        settings.unsafeURLsText = "urls: invalid\n";
        assert.equal((await parser.downloadProfile({ url: `${origin}/listed` })).success, false);
        settings.unsafeURLOriginsText = yaml.stringify({ origins: [origin] });
        assert.equal((await parser.downloadProfile({ url: `${origin}/changing/path?token=example` })).success, true);
        const otherPort = await listen(t, https.createServer(tls, (_request, response) => response.end("proxies: []")));
        assert.equal((await parser.downloadProfile({ url: `https://127.0.0.1:${otherPort}/changing/path` })).success, false);
        settings.unsafeURLOriginsText = "origins: []\n";
        assert.equal((await parser.downloadProfile({ url: `${origin}/changing/path?token=example` })).success, false);
    });
}

test("environment-proxy tunnels recheck certificate exceptions on redirects without changing global TLS policy", async t => {
    let requests = 0;
    const port = await listen(t, https.createServer(tls, (request, response) => {
        requests++;
        if (request.url === "/redirect") { response.writeHead(302, { Location: "/unlisted" }); response.end(); }
        else response.end("okay");
    }));
    const origin = `https://localhost:${port}`;
    const proxyPort = await connectProxy(t);
    const source = `
        const assert = require('node:assert/strict');
        const https = require('node:https');
        const axios = require('./app/main/node_modules/axios/dist/node/axios.cjs');
        const { createCertificateRequestOptions } = require('./app/main/dist/electron/core/network/certificate-request-options');
        const origin = process.argv[1];
        const before = { ...https.globalAgent.options };
        const allowsCertificate = url => [origin + '/listed', origin + '/redirect'].includes(url);
        (async () => {
            for (const [pathname, expected] of [['/listed', true], ['/unlisted', false], ['/redirect', false]]) {
                let okay = false, failure;
                try { await axios.get(origin + pathname, { ...createCertificateRequestOptions({ url: origin + pathname, allowsCertificate }), timeout: 3000 }); okay = true; } catch (error) { failure = error.message; }
                assert.equal(okay, expected, failure);
            }
            assert.deepEqual({ ...https.globalAgent.options }, before);
        })().then(() => process.exit(0), error => { process.stderr.write(error.message); process.exit(1); });
    `;
    const proxy = `http://127.0.0.1:${proxyPort}`;
    await promisify(execFile)(process.execPath, ["-e", source, origin], {
        cwd: path.resolve(__dirname, "../../.."), windowsHide: true, timeout: 15000,
        env: { ...process.env, HTTPS_PROXY: proxy, https_proxy: proxy, HTTP_PROXY: proxy, http_proxy: proxy,
            ALL_PROXY: proxy, all_proxy: proxy, NO_PROXY: "", no_proxy: "" }
    });
    assert.equal(requests, 2);
});

test("disabling advertisements blocks new requests and discards an in-flight response", async () => {
    let complete, requests = 0;
    const saved = [];
    const page = homePage({ keys: { AD_IMAGES: "ads" },
        runtimeState: { adImages: "enabled-before-startup" },
        cache: { get: () => ["cached"], put: (...args) => saved.push(args) },
        publicContent: { getAds: () => { requests++; return new Promise(resolve => { complete = resolve; }); } } });
    const model = { settings: { disableLoadingAdsLink: false } };
    const pending = page.methods.preDownloadAds.call(model);
    model.settings.disableLoadingAdsLink = true;
    complete({ status: 200, data: { feedback: ["late response"] } });
    await pending;
    assert.equal(saved.length, 0);
    await page.methods.preDownloadAds.call(model);
    assert.equal(requests, 1);
    const watch = page.watch["settings.disableLoadingAdsLink"];
    (watch.handler || watch).call(model, true);
    assert.deepEqual(saved, [["ads", ""]]);
});
