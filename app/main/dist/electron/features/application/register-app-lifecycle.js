"use strict";

function registerAppLifecycle({
    app,
    dialog,
    getMainWindow,
    createMainWindow,
    showMainWindow,
    initializeLogging,
    registerShutdown,
    unsafeUrlPolicy
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
        _webContents,
        url,
        _error,
        certificate,
        callback
    ) {
        if (unsafeUrlPolicy.includes(url)) {
            event.preventDefault();
            callback(true);
            return;
        }

        const result = await dialog.showMessageBox({
            type: "warning",
            buttons: ["Trust", "Cancel"],
            title: "Certificate Error",
            message: `Failed verify the certificate for ${url}. This may be because the certificate is self-signed or the certificate authority is not recognized. Do you want to trust this certificate?`
        });
        if (result.response === 0) {
            dialog.showCertificateTrustDialog(getMainWindow(), {
                certificate,
                message: "If you keep seeing this error, you need to go to Keychain APP to trust the certificate."
            }).catch(function(error) {
                console.error(error);
            });
        }
        callback(false);
    });
}

module.exports = { registerAppLifecycle };
