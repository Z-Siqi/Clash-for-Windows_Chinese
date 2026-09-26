"use strict";

function createTrayLifecycle({
    ipcMain,
    Tray,
    Menu,
    nativeImage,
    path,
    staticRoot,
    platform = process.platform,
    buildContextMenu,
    showMainWindow,
    onTrayChanged = function() {}
}) {
    let tray = null;

    function create() {
        if (tray) return tray;

        const macIcon = nativeImage
            .createFromPath(path.join(staticRoot, "imgs", "logo_64_eyes.png"))
            .resize({ width: 24, height: 24 });
        macIcon.setTemplateImage(true);
        const icons = {
            win32: path.join(staticRoot, "tray", "win", "tray_normal.ico"),
            darwin: macIcon,
            linux: path.join(staticRoot, "imgs", "logo_reverse_32.png")
        };

        tray = new Tray(icons[platform]);
        tray.setToolTip("Clash for Windows");
        tray.on("right-click", function() {
            buildContextMenu().then(function(template) {
                if (tray) tray.popUpContextMenu(Menu.buildFromTemplate(template));
            });
        });
        tray.on("click", function() {
            if (platform !== "darwin") showMainWindow();
        });
        tray.on("mouse-down", showMainWindow);
        onTrayChanged(tray);
        return tray;
    }

    function destroy() {
        if (tray) {
            tray.destroy();
            tray = null;
            onTrayChanged(null);
        }
    }

    ipcMain.handle("tray-create-destroy", function(_event, operation = "create") {
        if (operation === "create") create();
        if (operation === "destroy") destroy();
    });

    return { create, destroy, getTray: () => tray };
}

module.exports = { createTrayLifecycle };
