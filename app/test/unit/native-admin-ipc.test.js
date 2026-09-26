"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const { createNativeAdminClient } = require(path.join(
    root,
    "app/main/dist/electron/core/native/native-admin-client"
));
const { registerNativeAdminIpc } = require(path.join(
    root,
    "app/main/dist/electron/entry/main/register-native-admin-ipc"
));

async function run() {
    const invokes = [];
    const client = createNativeAdminClient({
        ipcRenderer: {
            invoke(...args) {
                invokes.push(args);
                return Promise.resolve(true);
            }
        },
        getBinaryPath: () => "C:\\package\\resources\\static\\files\\win\\x64\\mihomo-windows-amd64.exe",
        getClashPath: () => "C:\\Users\\tester\\.config\\clash",
        getFilesPath: () => "C:\\package\\resources\\static\\files"
    });
    await client.firewall.add();
    await client.service.install(0);
    assert.deepEqual(invokes.map(call => call.slice(0, 3)), [
        ["native-admin", "firewall", "add"],
        ["native-admin", "service", "install"]
    ]);
    assert.equal(invokes[0][3].binaryPath.endsWith("mihomo-windows-amd64.exe"), true);
    assert.equal(invokes[1][3].method, 0);

    const handlers = new Map();
    const elevated = [];
    const ordinary = [];
    const mainWindow = { webContents: {} };
    registerNativeAdminIpc({
        ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
        app: {
            isPackaged: true,
            getPath(name) {
                if (name === "home") return "C:\\Users\\tester";
                if (name === "exe") return "C:\\package\\Clash for Windows.exe";
                if (name === "temp") return "C:\\Temp";
                throw new Error(`unexpected app path ${name}`);
            }
        },
        getMainWindow: () => mainWindow,
        fs: {
            realpathSync: value => path.win32.resolve(value),
            existsSync: () => false,
            readFileSync: () => Buffer.from("fixture")
        },
        path: path.win32,
        crypto: require("node:crypto"),
        childProcess: {
            exec(command, options, callback) {
                ordinary.push([command, options]);
                callback(null, "False", "");
            }
        },
        sudoPrompt: {
            exec(command, options, callback) {
                elevated.push([command, options]);
                callback(null, "", "");
            }
        },
        axios: {
            get: async () => ({ status: 200 }),
            post: async () => ({ status: 200 })
        },
        platform: "win32",
        arch: "x64",
        resourcesPath: "C:\\package\\resources"
    });
    const handler = handlers.get("native-admin");
    const event = { sender: mainWindow.webContents };
    const base = {
        clashPath: "C:\\Users\\tester\\.config\\clash",
        filesPath: "C:\\package\\resources\\static\\files"
    };
    assert.equal(await handler(event, "firewall", "status", {
        ...base,
        binaryPath: "C:\\package\\resources\\static\\files\\win\\x64\\mihomo-windows-amd64.exe"
    }), false);
    assert.equal(ordinary.length, 1);
    assert.equal(elevated.length, 0);

    assert.equal(await handler(event, "firewall", "add", {
        ...base,
        binaryPath: "C:\\package\\resources\\static\\files\\win\\x64\\mihomo-windows-amd64.exe"
    }), false);
    assert.equal(elevated.length, 1);
    const firewallScript = Buffer.from(
        elevated[0][0].split("-EncodedCommand ")[1],
        "base64"
    ).toString("utf16le");
    assert.match(firewallScript, /New-NetFirewallRule/);

    assert.equal(await handler(event, "service", "install", { ...base, method: 0 }), true);
    assert.equal(elevated.length, 2);
    assert.match(elevated[1][0], /schtasks \/create/);
    assert.match(elevated[1][0], /Clash Core Service/);

    await assert.rejects(
        handler(event, "firewall", "add", {
            ...base,
            binaryPath: "C:\\Windows\\System32\\cmd.exe"
        }),
        /outside the packaged files directory/
    );
    await assert.rejects(
        handler({ sender: {} }, "service", "install", { ...base, method: 0 }),
        /did not originate from the main window/
    );
    await assert.rejects(
        handler(event, "service", "install", { ...base, method: 9 }),
        /Unsupported Windows Service Mode install method/
    );

    console.log("native administrator IPC smoke: PASS");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
