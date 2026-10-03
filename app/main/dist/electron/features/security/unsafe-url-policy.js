"use strict";

function createUnsafeUrlPolicy({ ipcMain, getMainWindow }) {
    let allowedUrls = new Set();

    ipcMain.on("set-allow-unsafe-urls", function(event, urls) {
        const owner = getMainWindow()?.webContents;
        if (!owner || event?.sender !== owner || event.senderFrame !== owner.mainFrame) return;
        if (!Array.isArray(urls) || urls.length > 128) return;
        const normalized = [];
        for (const value of urls) {
            try {
                const url = new URL(value);
                if (typeof value !== "string" || value.length > 4096 || url.protocol !== "https:" || url.username || url.password) return;
                normalized.push(url.href);
            } catch { return; }
        }
        allowedUrls = new Set(normalized);
    });

    return {
        allowsCertificate(url, webContents) {
            const owner = getMainWindow()?.webContents;
            if (!owner || owner !== webContents) return false;
            try { return allowedUrls.has(new URL(url).href); } catch { return false; }
        }
    };
}

module.exports = { createUnsafeUrlPolicy };
