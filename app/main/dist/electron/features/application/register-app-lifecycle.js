"use strict";

const { createTranslator } = require("../../core/i18n/language");

function registerAppLifecycle({
    app,
    dialog,
    getMainWindow,
    createMainWindow,
    showMainWindow,
    initializeLogging,
    registerShutdown,
    unsafeUrlPolicy,
    getLanguage = () => createTranslator(1)
}) {
    app.setAppUserModelId("com.lbyczf.clashwin");
    app.setAsDefaultProtocolClient("clash");
    app.setName("Clash for Windows");
    app.setAboutPanelOptions({ version: "" });

    app.on("open-url", function(_event, url) {
        getMainWindow().webContents.send("app-open", [url]);
    });

    if (app.requestSingleInstanceLock()) {
        app.on("second-instance", function(_event, commandLine) {
            const mainWindow = getMainWindow();
            if (mainWindow) {
                mainWindow.webContents.send("app-open", commandLine);
                if (mainWindow.isMinimized()) mainWindow.restore();
                showMainWindow();
            }
        });
        app.on("ready", function() {
            initializeLogging();
            registerShutdown();
            createMainWindow();
        });
    } else {
        app.quit();
    }

    app.on("activate", function() {
        if (getMainWindow() === null) createMainWindow();
        else showMainWindow();
    });

    app.on("certificate-error", async function(
        event,
        webContents,
        url,
        _error,
        certificate,
        callback
    ) {
        if (unsafeUrlPolicy.allowsCertificate(url, webContents)) {
            event.preventDefault();
            callback(true);
            return;
        }

        const labels = getLanguage();
        const result = await dialog.showMessageBox({
            type: "warning",
            buttons: [labels.trustCertificate(), labels.cancel()],
            title: labels.certificateErrorTitle(),
            message: labels.certificateErrorMessage({ url })
        });
        if (result.response === 0) {
            dialog.showCertificateTrustDialog(getMainWindow(), {
                certificate,
                message: labels.certificateTrustMessage()
            }).catch(function(error) {
                console.error(error);
            });
        }
        callback(false);
    });
}

module.exports = { registerAppLifecycle };
