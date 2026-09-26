"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { registerSpeedIndicator } = require("../../main/dist/electron/features/tray/register-speed-indicator");

test("speed indicator window uses an isolated channel-specific preload", () => {
    let listener;
    let createdWindow;
    let writtenHtml;
    class BrowserWindow {
        constructor(options) {
            this.options = options;
            this.webContents = { send() {} };
            createdWindow = this;
        }
        loadFile(file) { this.file = file; }
        show() {}
        setBounds() {}
    }

    const preloadPath = "C:\\electron\\entry\\preload\\speed-indicator.js";
    registerSpeedIndicator({
        ipcMain: { on(_channel, callback) { listener = callback; } },
        BrowserWindow,
        nativeImage: {
            createFromDataURL() {
                return {
                    crop() {
                        return {
                            getSize: () => ({ width: 88, height: 69 }),
                            toDataURL: () => "data:image/png;base64,safe"
                        };
                    }
                };
            }
        },
        app: { getPath: () => "C:\\temp" },
        fs: { writeFileSync(_file, html) { writtenHtml = html; } },
        path,
        staticRoot: "C:\\static",
        preloadPath,
        getTray: () => ({}),
        platform: "win32"
    });

    listener({}, "data:image/png;base64,input", 80, "#fff");
    assert.equal(createdWindow.options.webPreferences.nodeIntegration, false);
    assert.equal(createdWindow.options.webPreferences.contextIsolation, true);
    assert.equal(createdWindow.options.webPreferences.sandbox, true);
    assert.equal(createdWindow.options.webPreferences.preload, preloadPath);
    assert.doesNotMatch(writtenHtml, /\brequire\s*\(|\bprocess\b/);
    assert.doesNotMatch(writtenHtml, /<script|onclick=/);
    assert.match(writtenHtml, /Content-Security-Policy/);
    assert.match(writtenHtml, /id="click-target"/);

    const preload = fs.readFileSync(path.join(__dirname, "../../main/dist/electron/entry/preload/speed-indicator.js"), "utf8");
    assert.match(preload, /ipcRenderer\.on\("speed-update-win"/);
    assert.match(preload, /ipcRenderer\.send\("enhanced-tray-click"\)/);
    assert.doesNotMatch(preload, /contextBridge|exposeInMainWorld/);
    assert.doesNotMatch(preload, /ipcRenderer\.(?:invoke|send)\([^"']/);
});
