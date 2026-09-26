"use strict";

const fs = require("node:fs");
const path = require("node:path");

const mainPath = path.resolve(__dirname, "../../app/main/dist/electron/main.js");
let source = fs.readFileSync(mainPath, "utf8");
const newline = source.includes("\r\n") ? "\r\n" : "\n";
const startText = "            var O_CN = host.Menu.buildFromTemplate([{";
const endText = "            function D() {";
const start = source.indexOf(startText);
const end = source.indexOf(endText, start + startText.length);

if (start < 0 || end < 0 || source.indexOf(startText, start + 1) >= 0) {
    throw new Error("static tray menu extraction anchors are invalid or already applied");
}

const replacement = [
    "            var trayMenuActions = {",
    "                showDashboard: Launch,",
    "                sendRenderer: function(channel) {",
    "                    var args = Array.prototype.slice.call(arguments, 1);",
    "                    return g.webContents.send.apply(g.webContents, [channel].concat(args))",
    "                },",
    "                toggleDevTools: function() {",
    "                    g.webContents.toggleDevTools()",
    "                },",
    "                moveToNearestMonitor: function() {",
    "                    g.setBounds(B(g.getBounds())), Launch()",
    "                },",
    "                restart: RelaunchApp,",
    "                forceQuit: function() {",
    "                    host.app.isQuiting = !0, host.app.quit()",
    "                },",
    "                requestQuit: function() {",
    "                    if (g.isMaximized) g.unmaximize();",
    "                    return g.webContents.send(\"app-exit\")",
    "                }",
    "            };",
    "            var O_CN = buildStaticTrayMenu({",
    "                Menu: host.Menu, locale: \"cn\", state: state, actions: trayMenuActions",
    "            });",
    "            var O_EN = buildStaticTrayMenu({",
    "                Menu: host.Menu, locale: \"en\", state: state, actions: trayMenuActions",
    "            });",
    "",
    ""
].join(newline);

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(mainPath, source, "utf8");
console.log("static tray menu extraction applied");
