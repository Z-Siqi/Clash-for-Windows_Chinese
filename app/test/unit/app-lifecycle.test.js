"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const mainPath = path.join(root, "app/main/dist/electron/main.js");
const {
    registerAppLifecycle
} = require(path.join(
    root,
    "app/main/dist/electron/features/application/register-app-lifecycle"
));

async function main() {
    const events = new Map();
    const calls = [];
    const sent = [];
    const mainWindow = {
        webContents: { send: (...args) => sent.push(args) },
        isMinimized: () => true,
        restore: () => calls.push(["restore"])
    };
    const app = createApp(true, events, calls);
    let certificateResponse = 1;
    const dialog = {
        showMessageBox: async options => {
            calls.push(["message-box", options.title]);
            return { response: certificateResponse };
        },
        showCertificateTrustDialog: async (_window, options) => {
            calls.push(["trust-dialog", options.certificate]);
        }
    };
    registerAppLifecycle({
        app,
        dialog,
        getMainWindow: () => mainWindow,
        createMainWindow: () => calls.push(["create-window"]),
        showMainWindow: () => calls.push(["show-window"]),
        initializeLogging: () => calls.push(["logging"]),
        registerShutdown: () => calls.push(["shutdown"]),
        unsafeUrlPolicy: { includes: url => url === "https://allowed.test" }
    });

    assert.deepEqual(calls.slice(0, 4), [
        ["set-user-model", "com.lbyczf.clashwin"],
        ["set-protocol", "clash"],
        ["set-name", "Clash for Windows"],
        ["set-about", { version: "" }]
    ]);
    events.get("ready")();
    assert.deepEqual(calls.slice(-3), [["logging"], ["shutdown"], ["create-window"]]);
    events.get("second-instance")(null, ["clash://profile"]);
    assert.deepEqual(sent.at(-1), ["app-open", ["clash://profile"]]);
    assert.deepEqual(calls.slice(-2), [["restore"], ["show-window"]]);

    let prevented = false;
    let certificateResult;
    await events.get("certificate-error")(
        { preventDefault: () => { prevented = true; } },
        null,
        "https://allowed.test",
        "ERR_CERT",
        { id: "cert" },
        result => { certificateResult = result; }
    );
    assert.equal(prevented, true);
    assert.equal(certificateResult, true);

    prevented = false;
    await events.get("certificate-error")(
        { preventDefault: () => { prevented = true; } },
        null,
        "https://untrusted.test",
        "ERR_CERT",
        { id: "cert" },
        result => { certificateResult = result; }
    );
    assert.equal(prevented, false);
    assert.equal(certificateResult, false);
    assert.deepEqual(calls.at(-1), ["message-box", "Certificate Error"]);

    prevented = false;
    await events.get("certificate-error")(
        { preventDefault: () => { prevented = true; } },
        null,
        "https://raw.githubusercontent.com/Fndroid/ads/master/ads_v2.json",
        "ERR_CERT",
        { id: "legacy-ad-cert" },
        result => { certificateResult = result; }
    );
    assert.equal(prevented, false);
    assert.equal(certificateResult, false);
    assert.deepEqual(calls.at(-1), ["message-box", "Certificate Error"]);

    certificateResponse = 0;
    await events.get("certificate-error")(
        { preventDefault() {} },
        null,
        "https://trust-after-prompt.test",
        "ERR_CERT",
        { id: "trusted-cert" },
        result => { certificateResult = result; }
    );
    assert.equal(certificateResult, false);
    assert.deepEqual(calls.at(-1), ["trust-dialog", { id: "trusted-cert" }]);

    const deniedCalls = [];
    registerAppLifecycle({
        app: createApp(false, new Map(), deniedCalls),
        dialog,
        getMainWindow: () => null,
        createMainWindow() {},
        showMainWindow() {},
        initializeLogging() {},
        registerShutdown() {},
        unsafeUrlPolicy: { includes: () => false }
    });
    assert.deepEqual(deniedCalls.at(-1), ["quit"]);

    verifyDelegation();
    console.log("app lifecycle smoke: PASS");
}

function createApp(hasLock, events, calls) {
    return {
        setAppUserModelId: value => calls.push(["set-user-model", value]),
        setAsDefaultProtocolClient: value => calls.push(["set-protocol", value]),
        setName: value => calls.push(["set-name", value]),
        setAboutPanelOptions: value => calls.push(["set-about", value]),
        requestSingleInstanceLock: () => hasLock,
        on: (event, listener) => events.set(event, listener),
        quit: () => calls.push(["quit"])
    };
}

function verifyDelegation() {
    const source = fs.readFileSync(mainPath, "utf8");
    assert.match(
        source,
        /require\("\.\/features\/application\/register-app-lifecycle"\)/
    );
    assert.match(source, /registerAppLifecycle\(\{/);
    for (const oldOwner of [
        "host.app.requestSingleInstanceLock()",
        'host.app.on("open-url"',
        'host.app.on("second-instance"',
        'host.app.on("ready"',
        'host.app.on("activate"',
        'host.app.on("certificate-error"'
    ]) {
        assert.equal(source.includes(oldOwner), false, `main.js still owns ${oldOwner}`);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
