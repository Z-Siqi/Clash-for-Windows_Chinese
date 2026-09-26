"use strict";

function createUnsafeUrlPolicy({ ipcMain }) {
    let allowedUrls = [];

    ipcMain.on("set-allow-unsafe-urls", function(_event, urls) {
        allowedUrls = Array.isArray(urls) ? urls : [];
    });

    return {
        includes(url) {
            return allowedUrls.includes(url);
        }
    };
}

module.exports = { createUnsafeUrlPolicy };
