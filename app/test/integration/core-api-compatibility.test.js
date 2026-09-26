"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const dgram = require("node:dgram");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test } = require("node:test");
const { bundledRefresh } = require("../fixtures/bundled-refresh");
const { verifyDisconnect } = require("../fixtures/core-disconnect");
const { createClashApi } = require("../../main/dist/electron/core/network/clash-api");
const { buildStore } = require("../fixtures/renderer-store");
const { homePage } = require("../fixtures/home-page");
const { persistSelection } = require("../../main/dist/electron/features/profiles/persist-selection");
const { profilePage, proxiesPage } = require("../fixtures/profile-pages");

const root = path.resolve(__dirname, "../../..");
const targets = {
    "win32:x64": {
        clash: "app/clash_core/win_x64/static/files/win/x64/clash-win64.exe",
        mihomo: "app/clash_core/win_x64/static/files/win/x64/mihomo-windows-amd64.exe"
    },
    "win32:ia32": {
        clash: "app/clash_core/win32-ia32/static/files/win/ia32/clash-win32.exe",
        mihomo: "app/clash_core/win32-ia32/static/files/win/ia32/mihomo-windows-386.exe"
    },
    "win32:arm64": {
        clash: "app/clash_core/win32-arm64/static/files/win/arm64/clash-win-arm64.exe",
        mihomo: "app/clash_core/win32-arm64/static/files/win/arm64/mihomo-windows-arm64.exe"
    },
    "linux:x64": {
        clash: "app/clash_core/linux-x64/static/files/linux/x64/clash-linux",
        mihomo: "app/clash_core/linux-x64/static/files/linux/x64/mihomo-linux-amd64"
    },
    "linux:arm64": {
        clash: "app/clash_core/linux-arm64/static/files/linux/arm64/clash-linux",
        mihomo: "app/clash_core/linux-arm64/static/files/linux/arm64/mihomo-linux-arm64"
    },
    "darwin:x64": {
        clash: "app/clash_core/darwin-x64/static/files/darwin/x64/clash-darwin",
        mihomo: "app/clash_core/darwin-x64/static/files/darwin/x64/mihomo-darwin-amd64"
    },
    "darwin:arm64": {
        clash: "app/clash_core/darwin-arm64/static/files/darwin/arm64/clash-darwin",
        mihomo: "app/clash_core/darwin-arm64/static/files/darwin/arm64/mihomo-darwin-arm64"
    }
};
const platformTargets = targets[`${process.platform}:${process.arch}`];

async function freePort(excluded = []) {
    // The mixed listener needs both TCP and UDP; a TCP-only probe can select a
    // port reserved for UDP by Windows or already occupied by another process.
    for (let attempt = 0; attempt < 100; attempt++) {
        const port = await new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on("error", reject);
            server.listen(0, "127.0.0.1", () => {
                const { port } = server.address();
                if (excluded.includes(port)) return server.close(() => resolve(0));
                const udp = dgram.createSocket("udp4");
                udp.once("error", error => {
                    udp.close();
                    server.close(() => ["EACCES", "EADDRINUSE"].includes(error.code) ? resolve(0) : reject(error));
                });
                udp.bind(port, "127.0.0.1", () => {
                    udp.close(() => server.close(error => error ? reject(error) : resolve(port)));
                });
            });
        });
        if (port) return port;
    }
    throw Error("Could not find an available loopback TCP/UDP port");
}

function request(port, method, pathname, payload) {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: "127.0.0.1",
            port,
            path: pathname,
            method,
            headers: {
                Authorization: "Bearer compatibility-test",
                ...(body ? {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body)
                } : {})
            }
        }, response => {
            let data = "";
            response.setEncoding("utf8");
            response.on("data", chunk => { data += chunk; });
            response.on("end", () => resolve({ status: response.statusCode, data }));
        });
        req.on("error", reject);
        req.setTimeout(1000, () => req.destroy(new Error("request timed out")));
        req.end(body);
    });
}

async function waitForApi(port, child, output) {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`core exited early\n${output.value}`);
        try {
            const response = await request(port, "GET", "/version");
            if (response.status === 200) return response;
        } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`core API did not start\n${output.value}`);
}

async function stopChild(child) {
    if (child.exitCode !== null) return;
    const exited = new Promise(resolve => child.once("exit", resolve));
    child.kill();
    await Promise.race([
        exited,
        new Promise((_, reject) => setTimeout(
            () => reject(new Error(`core process ${child.pid} did not exit`)),
            5000
        ))
    ]);
}

async function verifyCore(coreName, relativeBinary) {
    const binary = path.join(root, relativeBinary);
    if (process.platform !== "win32") fs.chmodSync(binary, 0o755);
    const home = fs.mkdtempSync(path.join(os.tmpdir(), `cfw-${coreName}-`));
    const controllerPort = await freePort();
    const initialMixedPort = await freePort([controllerPort]);
    const updatedMixedPort = await freePort([controllerPort, initialMixedPort]);
    fs.copyFileSync(
        path.join(root, "app/clash_core/win_x64/static/files/default/Country.mmdb"),
        path.join(home, "Country.mmdb")
    );
    fs.writeFileSync(path.join(home, "config.yaml"), [
        `mixed-port: ${initialMixedPort}`,
        `external-controller: 127.0.0.1:${controllerPort}`,
        "secret: compatibility-test",
        "mode: direct",
        "log-level: info",
        "proxies: []",
        "proxy-groups: []",
        "rules: []",
        ""
    ].join("\n"));

    const output = { value: "" };
    const child = spawn(binary, ["-d", home], {
        cwd: path.dirname(binary),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", chunk => { output.value += chunk; });
    child.stderr.on("data", chunk => { output.value += chunk; });
    try {
        const version = await waitForApi(controllerPort, child, output);
        assert.match(version.data, /version/i);
        const apiCalls = [];
        const client = Object.fromEntries(["get", "put", "patch", "delete"].map(method => [method, async (url, payload) => {
            apiCalls.push([method, url]);
            const response = await request(controllerPort, method.toUpperCase(), url, ["get", "delete"].includes(method) ? undefined : payload);
            return { status: response.status, data: response.data ? JSON.parse(response.data) : "" };
        }]));
        const api = createClashApi({ getClient: () => client });
        const scriptModeResponse = await request(controllerPort, "PATCH", "/configs", { mode: "script" });
        const modeAfterScriptRequest = JSON.parse((await request(controllerPort, "GET", "/configs")).data).mode;
        if (coreName === "clash") {
            assert.equal(scriptModeResponse.status, 204, scriptModeResponse.data || output.value);
            assert.equal(modeAfterScriptRequest, "script");
        } else {
            assert.notEqual(scriptModeResponse.status, 204, "Mihomo unexpectedly accepted legacy Script mode");
            assert.notEqual(modeAfterScriptRequest, "script");
        }
        const restoreMode = await request(controllerPort, "PATCH", "/configs", { mode: "direct" });
        assert.equal(restoreMode.status, 204, restoreMode.data || output.value);
        // Exercise connections on the initial listener before changing ports or profile files.
        // A responding controller alone does not mean core startup has finished applying config.
        try { await verifyDisconnect(api, initialMixedPort); }
        catch (error) {
            const listenerLogs = output.value.split(/\r?\n/).filter(line => /listen|bind|mixed/i.test(line) && !/secret|authorization|bearer/i.test(line));
            throw new Error(`${error.message}\n${listenerLogs.join("\n")}`);
        }
        const patch = await request(controllerPort, "PATCH", "/configs", {
            "mixed-port": updatedMixedPort
        });
        assert.equal(patch.status, 204, patch.data || output.value);
        const config = await request(controllerPort, "GET", "/configs");
        assert.equal(config.status, 200, config.data);
        assert.equal(JSON.parse(config.data)["mixed-port"], updatedMixedPort);
        fs.writeFileSync(path.join(home, "application.yaml"), [
            "proxies: []", "proxy-groups:", "  - name: app-test", "    type: select",
            "    proxies: [DIRECT, REJECT]", 'rules: ["MATCH,DIRECT"]'
        ].join("\n"));
        fs.writeFileSync(path.join(home, "list.yml"), JSON.stringify({ index: 0, files: [{ time: "application.yaml", mode: "rule", selected: [{ name: "app-test", now: "REJECT" }] }] }));
        const { store } = buildStore({ home, axios: { create: () => client } });
        store.commit("LOAD_PROFILES");
        store.commit("SET_CONF_DATA", { data: { ipv6: false, "log-level": "warning", "external-controller": `127.0.0.1:${controllerPort}` } });
        const model = {
            profilesPath: home,
            get profiles() { return store.state.app.profiles; },
            get pfs() { return store.state.app.profiles; },
            get settings() { return store.state.app.settings; },
            get confData() { return store.state.app.confData; },
            get menuItems() { return store.state.app.menuItems; },
            get clashApi() { return store.getters.clashApi; },
            setCurrentProfilePayload: payload => store.commit("SET_CURRENT_PROFILE_PAYLOAD", payload),
            setMenuItems: payload => store.commit("SET_MENU_ITEMS", payload), resetDNS() {}, killSpawned() {},
            changeProfile: payload => store.commit("CHANGE_PROFILE", payload),
            switchMode: mode => store.dispatch("setMode", { mode })
        };
        model.refreshProfile = bundledRefresh().bind(model);
        const dialogs = [];
        const profilesUi = profilePage({ store, parent: model, dialogs });
        await profilesUi.handleProfileClick(0);
        assert.equal(dialogs.length, 0);
        assert.equal(profilesUi.loadingProfileIndex.length, 0);
        const applied = await api.getConfig();
        assert.equal(applied.data.mode, "rule");
        assert.equal(applied.data["mixed-port"], updatedMixedPort);
        assert.equal(applied.data["log-level"], coreName === "clash" ? "warn" : "warning");
        const proxies = await api.getProxies();
        assert.equal(proxies.data.proxies["app-test"].now, "REJECT");
        assert.equal(store.state.app.currentProfilePayload["proxy-groups"][0].name, "app-test");
        assert.equal(store.state.app.mode, "rule");
        const proxiesUi = proxiesPage(store);
        await proxiesUi.fetchData();
        assert.equal(proxiesUi.proxyInMode.some(group => group.name === "app-test"), true);
        assert.equal(proxiesUi.proxyInMode.find(group => group.name === "app-test").data.now, "REJECT");
        await homePage({ persistSelection }).methods.persistSelectedProxy.call(model);
        const restarted = buildStore({ home }).store;
        restarted.commit("LOAD_PROFILES");
        assert.equal(restarted.state.app.profiles.files[0].selected.find(group => group.name === "app-test").now, "REJECT");

        // Exercise malformed YAML and core-level validation through the actual click handlers.
        fs.writeFileSync(path.join(home, "broken.yaml"), "proxy-groups: [\n");
        fs.writeFileSync(path.join(home, "invalid.yaml"), "proxy-groups:\n  - name: invalid\n    type: no-such-type\n");
        store.commit("APPEND_PROFILE", { profile: { time: "broken.yaml" } });
        store.commit("APPEND_PROFILE", { profile: { time: "invalid.yaml" } });
        const writesBeforeSyntaxError = apiCalls.filter(([method, url]) => method === "put" && url === "/configs").length;
        await profilesUi.handleProfileClick(1);
        assert.equal(dialogs.length, 1);
        assert.equal(dialogs[0].type, "error");
        assert.match(dialogs[0].detail, /Error:/);
        assert.equal(store.state.app.profiles.index, -1);
        assert.equal(apiCalls.filter(([method, url]) => method === "put" && url === "/configs").length, writesBeforeSyntaxError);
        await profilesUi.handleProfileClick(2);
        assert.equal(dialogs.length, 2);
        assert.ok(dialogs[1].detail.length > 0);
        assert.equal(store.state.app.profiles.index, -1);
        assert.equal(profilesUi.loadingProfileIndex.length, 0);
        assert.equal(apiCalls.filter(([method, url]) => method === "put" && url === "/configs").length, writesBeforeSyntaxError + 1);
        await proxiesUi.fetchData();
        assert.equal(proxiesUi.proxyInMode.some(group => group.name === "app-test"), true);

        // A subsequent valid selection must replace the visible groups, including in Chinese.
        fs.writeFileSync(path.join(home, "second.yaml"), "proxy-groups:\n  - name: second-profile\n    type: select\n    proxies: [DIRECT, REJECT]\nrules: []\n");
        store.commit("APPEND_PROFILE", { profile: { time: "second.yaml", mode: "rule" } });
        model.refreshProfile = bundledRefresh(process.platform, 0).bind(model);
        await profilesUi.handleProfileClick(3);
        assert.equal(dialogs.length, 2);
        assert.equal(store.state.app.profiles.index, 3);
        await proxiesUi.fetchData();
        assert.equal(proxiesUi.proxyInMode.some(group => group.name === "second-profile"), true);
        assert.equal(proxiesUi.proxyInMode.some(group => group.name === "app-test"), false);
    } finally {
        await stopChild(child);
        fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
}

for (const coreName of ["clash", "mihomo"]) {
    test(`${coreName}: profile clicks validate YAML, apply configuration and update the Proxies page`, {
        skip: !platformTargets
    }, async () => {
        await verifyCore(coreName, platformTargets[coreName]);
    });
}
