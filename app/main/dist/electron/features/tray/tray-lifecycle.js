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
    let openMenu = null;
    let menuRequest = 0;
    let openProxyItems = new Map();

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
            const request = ++menuRequest;
            buildContextMenu().then(function(template) {
                if (tray && request === menuRequest) {
                    const menu = Menu.buildFromTemplate(template);
                    openMenu = menu;
                    openProxyItems = new Map();
                    function indexProxyItems(items = []) {
                        for (const item of items) {
                            if (item.id?.startsWith("tray-proxy-")) openProxyItems.set(item.id, item);
                            if (item.submenu?.items) indexProxyItems(item.submenu.items);
                        }
                    }
                    indexProxyItems(menu.items);
                    menu.once?.("menu-will-close", () => {
                        if (openMenu === menu) { openMenu = null; openProxyItems.clear(); }
                    });
                    tray.popUpContextMenu(menu);
                }
            }).catch(() => {});
        });
        tray.on("click", function() {
            if (platform !== "darwin") showMainWindow();
        });
        tray.on("mouse-down", showMainWindow);
        onTrayChanged(tray);
        return tray;
    }

    function destroy() {
        menuRequest++;
        openMenu = null;
        openProxyItems.clear();
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

    function updateProxyIcons(items) {
        for (const { id, icon } of items) {
            const item = openProxyItems.get(id);
            if (item) item.icon = icon;
        }
    }
    return { create, destroy, getTray: () => tray, getOpenMenu: () => openMenu, updateProxyIcons };
}

module.exports = { createTrayLifecycle };
