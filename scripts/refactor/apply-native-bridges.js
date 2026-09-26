"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const rendererPath = path.join(root, "app/main/dist/electron/renderer.js");
const original = fs.readFileSync(rendererPath, "utf8");
const newline = original.includes("\r\n") ? "\r\n" : "\n";
let source = original.replace(/\r\n/g, "\n");

function replaceOnce(before, after, label) {
    if (source.includes(after)) return;
    const first = source.indexOf(before);
    const last = source.lastIndexOf(before);
    if (first < 0 || first !== last) {
        throw new Error(`${label}: expected one unique migration anchor`);
    }
    source = `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

replaceOnce(
    'const { createServiceModeManager } = require("./features/service-mode/service-mode-manager");',
    'const { createServiceModeManager } = require("./features/service-mode/service-mode-manager");\n'
        + 'const { createClipboardClient } = require("./core/native/clipboard-client");\n'
        + 'const { createNativeAdminClient } = require("./core/native/native-admin-client");',
    "native bridge imports"
);

replaceOnce(
`                var sudoPrompt = i(72378),
                    childProcess = i(32081),
                    fileSystem = (i(72298), i(57147)),
                    platform = (i(71017), i(83566)),
                    store = i(59273),
                    firewallRuntime = require("./features/network/firewall-runtime"),
                    firewall = firewallRuntime.createFirewallRuntime({
                        isWindows: platform.Kr,
                        exec: function(command, options, callback) {
                            return (0, childProcess.exec)(command, options, callback)
                        },
                        sudoExec: function(command, options, callback) {
                            return (0, sudoPrompt.exec)(command, options, callback)
                        },
                        getBinaryPath: function() {
                            return store.Z.getters.clashBinaryPath
                        },
                        realpathSync: fileSystem.realpathSync
                    });`,
`                var electron = i(72298),
                    store = i(59273),
                    firewall = createNativeAdminClient({
                        ipcRenderer: electron.ipcRenderer,
                        getBinaryPath: function() { return store.Z.getters.clashBinaryPath },
                        getClashPath: function() { return store.Z.state.app.clashPath },
                        getFilesPath: function() { return store.Z.getters.filesPath }
                    }).firewall;`,
    "firewall administrator client"
);

for (const platform of ["darwin", "linux", "win32"]) {
    const platformAnchor = `                        platform: "${platform}",`;
    const start = source.indexOf(platformAnchor);
    if (start < 0) throw new Error(`${platform} Service Mode adapter is missing`);
    const nextModule = source.indexOf("            },", start);
    const block = source.slice(start, nextModule);
    if (block.includes("adminActions: createNativeAdminClient")) continue;
    const tailAnchor = platform === "linux"
        ? '                        getTempPath: function() { return i(72298).ipcRenderer.invoke("app", "getPath", "temp") }'
        : "                        hashFile: function(file) { return utilities.Ll(fileSystem.readFileSync(file)) }";
    const tailStart = source.indexOf(tailAnchor, start);
    if (tailStart < 0 || tailStart > nextModule) {
        throw new Error(`${platform} Service Mode tail anchor is missing`);
    }
    const replacement = `${tailAnchor},\n`
        + "                        adminActions: createNativeAdminClient({\n"
        + "                            ipcRenderer: i(72298).ipcRenderer,\n"
        + "                            getBinaryPath: function() { return store.getters.clashBinaryPath },\n"
        + "                            getClashPath: function() { return store.state.app.clashPath },\n"
        + "                            getFilesPath: function() { return store.getters.filesPath }\n"
        + "                        }).service";
    source = `${source.slice(0, tailStart)}${replacement}${source.slice(tailStart + tailAnchor.length)}`;
}

replaceOnce(
`            72298: e => {
                "use strict";
                e.exports = require("electron")
            },`,
`            72298: e => {
                "use strict";
                const electron = require("electron");
                e.exports = Object.assign({}, electron, {
                    clipboard: createClipboardClient(electron.ipcRenderer)
                })
            },`,
    "clipboard client"
);

// Parsing the complete legacy bundle catches accidental anchor spillover before writing.
new Function(source);
const output = newline === "\r\n" ? source.replace(/\n/g, "\r\n") : source;
if (output !== original) fs.writeFileSync(rendererPath, output);
