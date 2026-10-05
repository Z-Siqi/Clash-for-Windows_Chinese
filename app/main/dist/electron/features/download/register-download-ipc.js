"use strict";
const { config: releaseConfig } = require("../../core/release/release-info");

function registerDownloadIpc({ ipcMain, getMainWindow, app, fs, path, platform = process.platform }) {
    let pending;
    ipcMain.handle("start-download", function(event, value, ...destinations) {
        const owner = getMainWindow()?.webContents;
        if (!owner || event?.sender !== owner || event.senderFrame !== owner.mainFrame) throw new Error("Invalid download sender");
        if (destinations.length || pending) throw new Error("Invalid download request");
        const url = new URL(value);
        const segments = url.pathname.split("/");
        const extension = platform === "darwin" ? ".dmg" : ".exe";
        if (typeof value !== "string" || url.protocol !== "https:" || url.hostname !== "github.com" || url.port
            || url.username || url.password || `${segments[1]}/${segments[2]}` !== releaseConfig.repository
            || segments[3] !== "releases" || segments[4] !== "download" || segments.length !== 7
            || !segments[5] || !segments[6].endsWith(extension)) throw new Error("Unsupported update source");
        const directory = fs.mkdtempSync(path.join(app.getPath("temp"), "cfw-update-"));
        const target = path.join(directory, `cfw-update${extension}`);
        pending = { owner, target, url: url.href };
        try { owner.downloadURL(url.href); } catch (error) { pending = null; throw error; }
        return target;
    });
    getMainWindow().webContents.session.on("will-download", function(event, item, webContents) {
        // Another window's download must never consume this private save target.
        if (!pending || webContents !== pending.owner || item.getURLChain()[0] !== pending.url) return;
        const { owner, target } = pending;
        pending = null;
        item.setSavePath(target);
        const send = (...args) => { if (!owner.isDestroyed()) owner.send("download", ...args); };
        item.on("updated", function(_event, state) {
            if (state === "interrupted") send("interrupted");
            else if (state === "progressing") send(item.isPaused() ? "paused" : "downloading", item.getReceivedBytes() / item.getTotalBytes());
        });
        item.once("done", (_event, state) => state === "completed" ? send("completed") : send("failed", state));
    });
}

module.exports = { registerDownloadIpc };
