"use strict";

const fs = require("node:fs");
const path = require("node:path");

const mainPath = path.resolve(__dirname, "../../app/main/dist/electron/main.js");
let source = fs.readFileSync(mainPath, "utf8");

const requireAnchor = '        const { buildStaticTrayMenu } = require("./features/tray/build-static-tray-menu");';
const requireLine = '        const { createContextMenuBuilder } = require("./features/tray/build-context-menu");';
if (!source.includes(requireLine)) {
    if (!source.includes(requireAnchor)) throw new Error("context menu require anchor not found");
    source = source.replace(requireAnchor, `${requireAnchor}\n${requireLine}`);
}

const startAnchor = "            var o;\n            var state = createTrayState();";
const endAnchor = "            var trayLifecycle = createTrayLifecycle({";
const start = source.indexOf(startAnchor);
const end = source.indexOf(endAnchor, start);
if (start < 0 || end < 0 || source.indexOf(startAnchor, start + 1) >= 0) {
    throw new Error("dynamic context menu anchors were not uniquely found");
}

const replacement = `            var state = createTrayState();
            var trayMenuActions = {
                showDashboard: Launch,
                sendRenderer: function(channel) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    return g.webContents.send.apply(g.webContents, [channel].concat(args))
                },
                runTrayScript: function() {
                    return g.webContents.send("run-tray-script")
                },
                toggleDevTools: function() {
                    g.webContents.toggleDevTools()
                },
                moveToNearestMonitor: function() {
                    g.setBounds(B(g.getBounds())), Launch()
                },
                restart: RelaunchApp,
                forceQuit: function() {
                    host.app.isQuiting = !0, host.app.quit()
                },
                requestQuit: function() {
                    if (g.isMaximized) g.unmaximize();
                    return g.webContents.send("app-exit")
                }
            };
            var m = createContextMenuBuilder({
                state: state,
                isLinux: j,
                getClient: clashClient.getClient,
                nativeImage: host.nativeImage,
                path: M,
                staticRoot: __static,
                localize: function(english, chinese) {
                    return language(state.language, english, chinese)
                },
                actions: trayMenuActions
            });
`;

source = source.slice(0, start) + replacement + source.slice(end);

const duplicateActionsStart = source.indexOf("            var trayMenuActions = {", source.indexOf(endAnchor));
const staticMenuStart = source.indexOf("            var O_CN = buildStaticTrayMenu({", duplicateActionsStart);
if (duplicateActionsStart < 0 || staticMenuStart < 0) {
    throw new Error("duplicate tray actions anchors not found");
}
source = source.slice(0, duplicateActionsStart) + source.slice(staticMenuStart);

fs.writeFileSync(mainPath, source, "utf8");
console.log("dynamic context menu extraction applied");
