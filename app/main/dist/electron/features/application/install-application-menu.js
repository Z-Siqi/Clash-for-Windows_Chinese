"use strict";

function installApplicationMenu({ Menu, app, shell, requestQuit }) {
    const template = [
        {
            label: app.name,
            submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideothers" },
                { role: "unhide" },
                { label: "Close", accelerator: "Command+W", click() {} },
                { type: "separator" },
                { label: "退出 Clash for Windows", accelerator: "Command+Q", click: requestQuit }
            ]
        },
        { role: "editMenu" },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn", accelerator: "CmdOrCtrl+=" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" }
            ]
        },
        { role: "windowMenu" },
        {
            role: "help",
            submenu: [
                {
                    label: "Github",
                    click: () => shell.openExternal("https://github.com/Fndroid/clash_for_windows_pkg")
                },
                {
                    label: "Document",
                    click: () => shell.openExternal("https://docs.cfw.lbyczf.com/")
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    return menu;
}

module.exports = { installApplicationMenu };
