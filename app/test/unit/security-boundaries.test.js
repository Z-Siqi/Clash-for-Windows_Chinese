"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { registerDownloadIpc } = require("../../main/dist/electron/features/download/register-download-ipc");
const { createUnsafeUrlPolicy } = require("../../main/dist/electron/features/security/unsafe-url-policy");
const { createServiceCredentials, readServiceCredentials } = require("../../main/dist/electron/core/network/service-credentials");
const { buildPosixServiceInstall, posixServiceDirectory } = require("../../main/dist/electron/features/service-mode/install-posix-service");
const { createAuthorizedIpcMain } = require("../../main/dist/electron/core/native/authorized-ipc");

test("all legacy IPC channels reject other frames and the indicator can only show its owner", () => {
    const handlers = new Map(), listeners = new Map();
    const owner = { mainFrame: {} }, indicator = { mainFrame: {} };
    let called = 0;
    const ipc = createAuthorizedIpcMain({ ipcMain: { handle: (name, fn) => handlers.set(name, fn), on: (name, fn) => listeners.set(name, fn) }, getMainWindow: () => ({ webContents: owner }), getIndicatorWindow: () => ({ webContents: indicator }) });
    ipc.handle("window-control", () => { called++; });
    ipc.on("show-notification", () => { called++; });
    for (const event of [{ sender: {}, senderFrame: {} }, { sender: owner, senderFrame: {} }]) {
        assert.throws(() => handlers.get("window-control")(event, "show"), /Unauthorized/);
        listeners.get("show-notification")(event, {});
    }
    assert.equal(called, 0);
    const auxiliary = { sender: indicator, senderFrame: indicator.mainFrame };
    assert.throws(() => handlers.get("window-control")(auxiliary, "hide"), /Unauthorized/);
    handlers.get("window-control")(auxiliary, "show");
    listeners.get("show-notification")({ sender: owner, senderFrame: owner.mainFrame }, {});
    assert.equal(called, 2);
});

test("downloads authorize their owner, restrict update origins, and allocate private host paths", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-download-policy-"));
    try {
        const handlers = new Map(), listeners = new Map();
        const requested = [], saved = [];
        const owner = { mainFrame: {}, downloadURL: url => requested.push(url), isDestroyed: () => false, send() {}, session: { on: (name, fn) => listeners.set(name, fn) } };
        const event = { sender: owner, senderFrame: owner.mainFrame };
        registerDownloadIpc({ ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, getMainWindow: () => ({ webContents: owner }), app: { getPath: () => folder }, fs, path, platform: "win32" });
        const download = handlers.get("start-download");
        const url = "https://github.com/Z-Siqi/Clash-for-Windows_Chinese/releases/download/v1/update.exe";
        assert.throws(() => download({ sender: {}, senderFrame: {} }, url), /sender/);
        assert.throws(() => download({ ...event, senderFrame: {} }, url), /sender/);
        assert.throws(() => download(event, url, path.join(folder, "outside.exe")), /request/);
        for (const bad of [url.replace("github.com", "github.com.evil.test"), url.replace("https:", "http:"), url.replace("Z-Siqi", "other"), url.replace("update.exe", "update.cmd"), "file:///tmp/update.exe"]) assert.throws(() => download(event, bad), /source/);
        assert.equal(requested.length, 0);
        const target = download(event, url);
        assert.equal(path.dirname(path.dirname(target)), folder);
        assert.notEqual(path.dirname(target), folder);
        const item = { getURLChain: () => [url], setSavePath: value => saved.push(value), on() {}, once() {} };
        listeners.get("will-download")({}, item, {});
        assert.equal(saved.length, 0);
        listeners.get("will-download")({}, item, owner);
        assert.deepEqual(saved, [target]);
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

test("certificate exceptions reject foreign frames and match only exact HTTPS URLs in their owner", () => {
    let update;
    const owner = { mainFrame: {} };
    const policy = createUnsafeUrlPolicy({ ipcMain: { on: (_name, fn) => { update = fn; } }, getMainWindow: () => ({ webContents: owner }) });
    const url = "https://certificate.test/resource";
    update({ sender: {}, senderFrame: {} }, [url]);
    assert.equal(policy.allowsCertificate(url, owner), false);
    update({ sender: owner, senderFrame: {} }, [url]);
    assert.equal(policy.allowsCertificate(url, owner), false);
    update({ sender: owner, senderFrame: owner.mainFrame }, [url]);
    assert.equal(policy.allowsCertificate(url, owner), true);
    for (const other of ["https://certificate.test.evil/resource", `${url}/other`, "https://certificate.test/resource?other", "http://certificate.test/resource"]) assert.equal(policy.allowsCertificate(other, owner), false);
    assert.equal(policy.allowsCertificate(url, {}), false);
});

test("service credentials bind an installation to one data directory and use private atomic files", () => {
    const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cfw-service-credentials-")));
    try {
        const { file, credentials } = createServiceCredentials({ fs, path, crypto: require("node:crypto"), home });
        const loaded = readServiceCredentials({ fs, path, home });
        assert.ok(loaded.token === credentials.token);
        assert.equal(loaded.dataDirectory, home);
        if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o777, 0o600);
        fs.writeFileSync(file, JSON.stringify({ ...credentials, dataDirectory: path.dirname(home) }));
        assert.throws(() => readServiceCredentials({ fs, path, home }), /credentials/);
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test("POSIX service installations keep executable cores and policy outside writable user directories", () => {
    for (const platform of ["linux", "darwin"]) {
        const destination = posixServiceDirectory(platform);
        assert.ok(!destination.startsWith("/home/") && !destination.startsWith("/Users/"));
        const command = buildPosixServiceInstall({ platform, path: path.posix, destination, source: "/app's/files/service", credentialFile: "/home/user/credentials", manifest: { cores: [{ name: "clash-linux" }] }, serviceFile: "/etc/fixed-unit", serviceContent: "fixed unit" });
        assert.ok(command.includes("install -d -o root"));
        assert.ok(command.includes("-m 600"));
        assert.ok(command.includes(`${destination}/cores/clash-linux`));
        assert.ok(command.includes("'\"'\"'"));
        assert.throws(() => buildPosixServiceInstall({ platform, path: path.posix, manifest: { cores: [{ name: "../untrusted" }] } }), /manifest/);
    }
});

test("malformed log fields and legacy style literals finish in bounded time", () => {
    const compat = path.resolve(__dirname, "../../main/dist/electron/features/clash-core/core-api-compat.js");
    const extractor = path.resolve(__dirname, "../../../scripts/refactor/extract-legacy-renderer-styles.js");
    // A separate process timeout catches a blocking regex; a test timer alone cannot.
    const source = `const {parseCoreLogLine}=require(${JSON.stringify(compat)}); const {extractLegacyStyles}=require(${JSON.stringify(extractor)});
        const slash=String.fromCharCode(92);
        if (parseCoreLogLine('time="today" level=info msg="'+slash.repeat(100000)+'unterminated') !== null) throw Error('accepted malformed log');
        parseCoreLogLine('time="today" level=info msg="okay" '+ 'k'.repeat(100000));
        for (const quote of [String.fromCharCode(34), String.fromCharCode(39), String.fromCharCode(96)]) {
            if (extractLegacyStyles('.push([e.id,'+quote+slash.repeat(40)+'broken').length) throw Error('accepted malformed style');
        }`;
    execFileSync(process.execPath, ["-e", source], { timeout: 3000, stdio: "pipe" });
});
