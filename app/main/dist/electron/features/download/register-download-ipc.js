"use strict";

function registerDownloadIpc({ ipcMain, getMainWindow }) {
    let pendingSavePath = null;

    ipcMain.handle("start-download", function(_event, url, savePath) {
        const mainWindow = getMainWindow();
        mainWindow.webContents.downloadURL(url);
        pendingSavePath = savePath;
    });

    getMainWindow().webContents.session.on("will-download", function(_event, item) {
        if (!pendingSavePath) {
            return;
        }

        item.setSavePath(pendingSavePath);
        item.on("updated", function(_event, state) {
            if (state === "interrupted") {
                sendDownloadState("interrupted");
            } else if (state === "progressing") {
                if (item.isPaused()) {
                    sendDownloadState("paused");
                } else {
                    sendDownloadState(
                        "downloading",
                        item.getReceivedBytes() / item.getTotalBytes()
                    );
                }
            }
        });
        item.once("done", function(_event, state) {
            if (state === "completed") {
                sendDownloadState("completed");
            } else {
                sendDownloadState("failed", state);
            }
        });
        pendingSavePath = null;
    });

    function sendDownloadState(...args) {
        getMainWindow().webContents.send("download", ...args);
    }
}

module.exports = { registerDownloadIpc };
