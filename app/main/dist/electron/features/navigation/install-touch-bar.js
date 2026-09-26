"use strict";

const NAVIGATION_ITEMS = [
    ["General", "general"],
    ["Proxies", "proxy"],
    ["Profiles", "server"],
    ["Logs", "log"],
    ["连接", "connection"],
    ["Settings", "setting"],
    ["Feedback", "about"]
];

function installTouchBar({ mainWindow, TouchBar, TouchBarButton }) {
    const items = NAVIGATION_ITEMS.map(([label, route]) => new TouchBarButton({
        label,
        backgroundColor: "#505050",
        click() {
            mainWindow.webContents.send("menu-item-change", route);
        }
    }));
    mainWindow.setTouchBar(new TouchBar({ items }));
}

module.exports = { installTouchBar };
