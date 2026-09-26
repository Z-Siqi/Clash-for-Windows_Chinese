"use strict";

function registerNotificationIpc({
    ipcMain,
    Notification,
    nativeImage,
    shell,
    path,
    staticRoot,
    platform = process.platform
}) {
    ipcMain.on("show-notification", function(_event, options) {
        const iconPath = path.join(staticRoot, "imgs/logo_64.png");
        const notification = new Notification({
            ...options,
            icon: platform !== "darwin" ? nativeImage.createFromPath(iconPath) : null
        });

        if (options.folder) {
            notification.on("click", function() {
                shell.openPath(options.folder);
            });
        }
        if (options.url) {
            notification.on("click", function() {
                shell.openExternal(options.url);
            });
        }
        notification.show();
    });
}

module.exports = { registerNotificationIpc };
