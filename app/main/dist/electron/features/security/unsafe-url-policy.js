"use strict";

const { normalizeCertificateExceptions, matchesCertificateException } = require("../../core/network/certificate-exceptions");

function createUnsafeUrlPolicy({ ipcMain, getMainWindow }) {
    let allowedUrls = new Set();
    let allowedOrigins = new Set();
    let externalHttpAllowed = false;

    ipcMain.on("set-allow-unsafe-urls", function(event, urls, origins, allowExternalHttp) {
        const owner = getMainWindow()?.webContents;
        if (!owner || event?.sender !== owner || event.senderFrame !== owner.mainFrame) return;
        allowedUrls = new Set(normalizeCertificateExceptions(urls));
        allowedOrigins = new Set(normalizeCertificateExceptions(origins, true));
        externalHttpAllowed = allowExternalHttp === true;
    });

    return {
        allowsExternalHttp() { return externalHttpAllowed; },
        allowsCertificate(url, webContents) {
            const owner = getMainWindow()?.webContents;
            if (!owner || owner !== webContents) return false;
            return matchesCertificateException(url, allowedUrls, allowedOrigins);
        }
    };
}

module.exports = { createUnsafeUrlPolicy };
