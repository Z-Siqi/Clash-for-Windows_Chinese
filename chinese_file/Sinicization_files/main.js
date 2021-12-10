module.exports = function(e) {
    var t = {};

    function n(r) {
        if (t[r]) return t[r].exports;
        var o = t[r] = {
            i: r,
            l: !1,
            exports: {}
        };
        return e[r].call(o.exports, o, o.exports, n), o.l = !0, o.exports
    }
    return n.m = e, n.c = t, n.d = function(e, t, r) {
        n.o(e, t) || Object.defineProperty(e, t, {
            enumerable: !0,
            get: r
        })
    }, n.r = function(e) {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(e, "__esModule", {
            value: !0
        })
    }, n.t = function(e, t) {
        if (1 & t && (e = n(e)), 8 & t) return e;
        if (4 & t && "object" == typeof e && e && e.__esModule) return e;
        var r = Object.create(null);
        if (n.r(r), Object.defineProperty(r, "default", {
                enumerable: !0,
                value: e
            }), 2 & t && "string" != typeof e)
            for (var o in e) n.d(r, o, function(t) {
                return e[t]
            }.bind(null, o));
        return r
    }, n.n = function(e) {
        var t = e && e.__esModule ? function() {
            return e.default
        } : function() {
            return e
        };
        return n.d(t, "a", t), t
    }, n.o = function(e, t) {
        return Object.prototype.hasOwnProperty.call(e, t)
    }, n.p = "", n(n.s = 5)
}([function(e, t) {
    e.exports = require("electron")
}, function(e, t, n) {
    e.exports = n(6)
}, function(e, t) {
    e.exports = function(e, t, n) {
        return t in e ? Object.defineProperty(e, t, {
            value: n,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[t] = n, e
    }, e.exports.default = e.exports, e.exports.__esModule = !0
}, function(e, t) {
    function n(e, t, n, r, o, i, a) {
        try {
            var c = e[i](a),
                s = c.value
        } catch (e) {
            return void n(e)
        }
        c.done ? t(s) : Promise.resolve(s).then(r, o)
    }
    e.exports = function(e) {
        return function() {
            var t = this,
                r = arguments;
            return new Promise((function(o, i) {
                var a = e.apply(t, r);

                function c(e) {
                    n(a, o, i, c, s, "next", e)
                }

                function s(e) {
                    n(a, o, i, c, s, "throw", e)
                }
                c(void 0)
            }))
        }
    }, e.exports.default = e.exports, e.exports.__esModule = !0
}, function(e, t) {
    e.exports = require("path")
}, function(e, t, n) {
    "use strict";
    n.r(t);
    t = n(2);
    var r = n.n(t),
        o = (t = n(3), n.n(t)),
        i = (t = n(1), n.n(t)),
        a = n(0);

    function c(e, t) {
        var n, r = Object.keys(e);
        return Object.getOwnPropertySymbols && (n = Object.getOwnPropertySymbols(e), t && (n = n.filter((function(t) {
            return Object.getOwnPropertyDescriptor(e, t).enumerable
        }))), r.push.apply(r, n)), r
    }

    function s(e) {
        for (var t = 1; t < arguments.length; t++) {
            var n = null != arguments[t] ? arguments[t] : {};
            t % 2 ? c(Object(n), !0).forEach((function(t) {
                r()(e, t, n[t])
            })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : c(Object(n)).forEach((function(t) {
                Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t))
            }))
        }
        return e
    }
    var u, l, p, d, h, f = n(0).TouchBar,
        g = f.TouchBarButton,
        w = n(4),
        m = n(7),
        b = n(8);
    t = n(9);
    n(10).init(), global.__static = n(4).join(__dirname, "/static").replace(/\\/g, "\\\\"), t(), a.app.disableHardwareAcceleration(), a.app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors"), "darwin" === process.platform && a.app.dock.hide();
    var y = "file://".concat(__dirname, "/index.html");

    function v() {
        var e, t;

        function c() {
            var e, t, o, i;
            d || ((e = a.nativeImage.createFromPath(n(4).join(__static, "imgs", "logo_64_eyes.png")).resize({
                width: 24,
                height: 24
            })).setTemplateImage(!0), t = w.join(__static, "tray_normal.ico"), o = w.join(__static, "imgs", "logo_reverse.png"), i = {}, r()(i, "win32", t), r()(i, "darwin", e), r()(i, "linux", o), i = i[process.platform], (d = new a.Tray(i)).setToolTip("Clash for Windows"), d.on("right-click", (function() {
                d.popUpContextMenu(v)
            })), d.on("click", (function() {
                u.setBounds(x(u.getBounds())), u.show()
            })))
        }(u = new a.BrowserWindow({
            height: 603,
            width: 850,
            minWidth: 850,
            minHeight: 603,
            backgroundColor: "#f5f5f5",
            useContentSize: !0,
            show: !1,
            minimizable: !0,
            frame: !1,
            titleBarStyle: "hidden",
            icon: "linux" === process.platform ? w.join(__static, "imgs", "icon_512.png") : void 0,
            webPreferences: {
                nodeIntegration: !0,
                webSecurity: !0,
                nodeIntegrationInWorker: !1,
                contextIsolation: !1,
                preload: w.resolve(w.join(__dirname, "preload.js"))
            }
        })).setMenu(null), u.webContents.on("will-navigate", (function(e) {
            return e.preventDefault()
        })), u.loadURL(y, {
            userAgent: "ClashforWindows/".concat(a.app.getVersion())
        }), u.webContents.on("render-process-gone", (e = o()(i.a.mark((function e(t, n) {
            var r, o;
            return i.a.wrap((function(e) {
                for (;;) switch (e.prev = e.next) {
                    case 0:
                        if (r = n.reason, "darwin" === process.platform) return e.abrupt("return");
                        e.next = 3;
                        break;
                    case 3:
                        if ("crashed" === r) return o = {
                            type: "error",
                            title: "Clash for Windows",
                            message: "仪表板崩溃了!",
                            buttons: ["Reload", "Exit"]
                        }, e.next = 7, a.dialog.showMessageBox(u, o);
                        e.next = 10;
                        break;
                    case 7:
                        0 === (o = e.sent).response ? (a.app.relaunch(), a.app.exit(0)) : a.app.quit();
                    case 10:
                    case "end":
                        return e.stop()
                }
            }), e)
        }))), function(t, n) {
            return e.apply(this, arguments)
        })), a.ipcMain.handle("start-download", (function(e, t, n) {
            u.webContents.downloadURL(t), h = n
        })), u.webContents.session.on("will-download", (function(e, t, n) {
            t.setSavePath(h), t.on("updated", (function(e, n) {
                "interrupted" === n ? u.webContents.send("download", "interrupted") : "progressing" === n && (t.isPaused() ? u.webContents.send("download", "paused") : u.webContents.send("download", "downloading", t.getReceivedBytes() / t.getTotalBytes()))
            })), t.once("done", (function(e, t) {
                "completed" === t ? u.webContents.send("download", "completed") : u.webContents.send("download", "failed", t)
            }))
        })), a.ipcMain.handle("app", (function(e, t) {
            for (var n = arguments.length, r = new Array(2 < n ? n - 2 : 0), o = 2; o < n; o++) r[o - 2] = arguments[o];
            switch (t) {
                case "isPackaged":
                    return a.app.isPackaged;
                case "getPath":
                    return a.app.getPath.apply(a.app, r);
                case "getAppPath":
                    return a.app.getAppPath();
                case "getName":
                    return a.app.getName();
                case "getVersion":
                    return a.app.getVersion();
                case "setLoginItemSettings":
                    return a.app.setLoginItemSettings.apply(a.app, r);
                case "relaunch":
                    return a.app.relaunch();
                case "exit":
                    return a.app.exit.apply(a.app, r);
                case "quit":
                    return a.app.quit()
            }
        })), a.ipcMain.handle("window", (function(e, t) {
            switch (t) {
                case "close":
                    return u.close();
                case "minimize":
                    return u.minimize();
                case "maximize":
                    return u.maximize();
                case "unmaximize":
                    return u.unmaximize();
                case "setAlwaysOnTop":
                    for (var n = arguments.length, r = new Array(2 < n ? n - 2 : 0), o = 2; o < n; o++) r[o - 2] = arguments[o];
                    return u.setAlwaysOnTop.apply(u, r)
            }
        })), u.on("hide", (function() {
            u.webContents.send("window-event", "hide")
        })), u.on("show", (function() {
            "darwin" === process.platform && a.app.dock.show(), u.webContents.send("window-event", "show"), u.setBounds(x(u.getBounds()))
        })), u.on("close", (function(e) {
            return a.app.isQuiting ? (a.globalShortcut.unregisterAll(), a.app.exit()) : (e.preventDefault(), u.webContents.send("window-event", "close"), d ? (u.hide(), "darwin" === process.platform && a.app.dock.hide()) : u.minimize()), !1
        })), u.on("maximize", (function(e) {
            u.webContents.send("window-event", "maximize")
        })), u.on("unmaximize", (function(e) {
            u.webContents.send("window-event", "unmaximize")
        })), u.on("session-end", (function(e) {
            e.preventDefault(), u.webContents.send("app-exit")
        })), a.ipcMain.handle("webContent", (function(e, t) {
            if ("toggleDevTools" === t) return u.webContents.toggleDevTools()
        })), a.ipcMain.handle("dialog", (t = o()(i.a.mark((function e(t, n) {
            var r, o, c, s = arguments;
            return i.a.wrap((function(e) {
                for (;;) switch (e.prev = e.next) {
                    case 0:
                        for (r = s.length, o = new Array(2 < r ? r - 2 : 0), c = 2; c < r; c++) o[c - 2] = s[c];
                        e.t0 = n, e.next = "showMessageBox" === e.t0 ? 4 : "showOpenDialogSync" === e.t0 ? 7 : 8;
                        break;
                    case 4:
                        return e.next = 6, a.dialog.showMessageBox.apply(a.dialog, [u].concat(o));
                    case 6:
                        return e.abrupt("return", e.sent);
                    case 7:
                        return e.abrupt("return", a.dialog.showOpenDialogSync.apply(a.dialog, [u].concat(o)));
                    case 8:
                    case "end":
                        return e.stop()
                }
            }), e)
        }))), function(e, n) {
            return t.apply(this, arguments)
        })), a.ipcMain.handle("globalShortcut", (function(e, t) {
            for (var n = arguments.length, r = new Array(2 < n ? n - 2 : 0), o = 2; o < n; o++) r[o - 2] = arguments[o];
            switch (t) {
                case "register":
                    return a.globalShortcut.register(r[0], (function() {
                        u.webContents.send("shortcut-pressed", r[0])
                    }));
                case "unregister":
                    return a.globalShortcut.unregister.apply(a.globalShortcut, r);
                case "isRegistered":
                    return a.globalShortcut.isRegistered.apply(a.globalShortcut, r)
            }
        })), a.ipcMain.handle("nativeTheme", (function(e, t) {
            if ("shouldUseDarkColors" === t) return a.nativeTheme.shouldUseDarkColors
        })), a.nativeTheme.on("updated", (function() {
            u.webContents.send("native-theme-updated", a.nativeTheme.shouldUseDarkColors)
        })), a.ipcMain.handle("powerSaveBlocker", (function(e, t) {
            for (var n, r = arguments.length, o = new Array(2 < r ? r - 2 : 0), i = 2; i < r; i++) o[i - 2] = arguments[i];
            switch (t) {
                case "start":
                    return (n = powerSaveBlocker).start.apply(n, o);
                case "stop":
                    return (n = powerSaveBlocker).stop.apply(n, o)
            }
        })), u.setTouchBar(new f({
            items: [new g({
                label: "General",
                backgroundColor: "#505050",
                click: function() {
                    u.webContents.send("menu-item-change", "general")
                }
            }), new g({
                label: "Proxies",
                backgroundColor: "#505050",
                click: function() {
                    u.webContents.send("menu-item-change", "proxy")
                }
            }), new g({
                label: "Profiles",
                backgroundColor: "#505050",
                click: function() {
                    u.webContents.send("menu-item-change", "server")
                }
            }), new g({
                label: "Logs",
                backgroundColor: "#505050",
                click: function() {
                    u.webContents.send("menu-item-change", "log")
                }
            }), new g({
                label: "Connections",
                backgroundColor: "#505050",
                click: function() {
                    u.webContents.send("menu-item-change", "connection")
                }
            }), new g({
                label: "Settings",
                backgroundColor: "#505050",
                click: function() {
                    u.webContents.send("menu-item-change", "setting")
                }
            }), new g({
                label: "Feedback",
                backgroundColor: "#505050",
                click: function() {
                    u.webContents.send("menu-item-change", "about")
                }
            })]
        })), a.powerMonitor.on("suspend", (function() {
            u.webContents.send("power-event", "suspend")
        })), a.powerMonitor.on("resume", (function() {
            u.webContents.send("power-event", "resume")
        })), a.ipcMain.handle("window-control", (function(e, t) {
            switch (t) {
                case "hide":
                    a.app.quit();
                    break;
                case "show":
                    u.show();
                    break;
                case "show-or-hide":
                    u.isVisible() && u.isFocused() ? a.app.quit() : u.show()
            }
        })), a.ipcMain.on("cleanup-done", (function(e) {
            a.app.isQuiting = !0, a.app.quit()
        })), a.ipcMain.on("status-changed", (function(e, t) {
            try {
                "darwin" !== process.platform && d.setImage(t)
            } catch (e) {}
        })), a.ipcMain.on("show-notification", (function(e, t) {
            var n = w.join(global.__static, "imgs/logo_64.png"),
                r = new a.Notification(s(s({}, t), {}, {
                    icon: "darwin" !== process.platform ? a.nativeImage.createFromPath(n) : null
                })),
                o = (n = t.folder, t.url);
            n && r.on("click", (function() {
                a.shell.openPath(t.folder)
            })), o && r.on("click", (function() {
                a.shell.openExternal(o)
            })), r.show()
        }));
        var b = [{
                label: "仪表盘",
                click: function() {
                    return u.show()
                }
            }, {
                label: "运行任务栏脚本",
                visible: "linux" !== process.platform,
                click: function() {
                    return u.webContents.send("run-tray-script")
                }
            }, {
                type: "separator"
            }, {
                label: "系统代理",
                type: "checkbox",
                id: "system-proxy",
                enabled: !1,
                visible: "linux" !== process.platform,
                click: function(e) {
                    e = e.checked, u.webContents.send("system-proxy-changed", e)
                }
            }, {
                label: "TUN 模式",
                type: "checkbox",
                id: "tun",
                enabled: !1,
                click: function(e) {
                    e = e.checked, u.webContents.send("tun-changed", e)
                }
            }, {
                label: "混合配置",
                type: "checkbox",
                id: "mixin",
                enabled: !1,
                click: function(e) {
                    e = e.checked, u.webContents.send("mixin-changed", e)
                }
            }, {
                type: "separator"
            }, {
                label: "代理模式",
                id: "mode",
                enabled: !1
            }, {
                label: "全局",
                type: "radio",
                id: "mode-global",
                enabled: !1,
                click: function() {
                    return u.webContents.send("mode-changed", "global")
                }
            }, {
                label: "规则",
                type: "radio",
                id: "mode-rule",
                enabled: !1,
                click: function() {
                    return u.webContents.send("mode-changed", "rule")
                }
            }, {
                label: "直连",
                type: "radio",
                id: "mode-direct",
                enabled: !1,
                click: function() {
                    return u.webContents.send("mode-changed", "direct")
                }
            }, {
                label: "脚本",
                type: "radio",
                id: "mode-script",
                enabled: !1,
                click: function() {
                    return u.webContents.send("mode-changed", "script")
                }
            }, {
                type: "separator"
            }, {
                label: "更多",
                submenu: [{
                    label: "切换Dev工具",
                    click: function() {
                        u.webContents.toggleDevTools()
                    }
                }, {
                    label: "重启",
                    click: function() {
                        a.app.relaunch(), a.app.exit(0)
                    }
                }, {
                    label: "强制退出",
                    click: function() {
                        a.app.isQuiting = !0, a.app.quit()
                    }
                }]
            }, {
                type: "separator"
            }, {
                label: "退出",
                click: function() {
                    return u.webContents.send("app-exit")
                }
            }],
            v = a.Menu.buildFromTemplate(b);

        function k() {
            "linux" === process.platform && d && d.setContextMenu(v)
        }
        c(), a.ipcMain.handle("tray-create-destroy", (function(e) {
            var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : "create";
            "create" === t && c(), "destroy" === t && d && (d.destroy(), d = null)
        })), k(), a.ipcMain.on("clash-core-status-change", (function(e, t) {
            var n = v.getMenuItemById("system-proxy");
            n && (n.enabled = 1 !== t), (n = v.getMenuItemById("mixin")) && (n.enabled = 1 !== t), (n = v.getMenuItemById("tun")) && (n.enabled = 1 !== t), ["global", "rule", "direct", "script"].forEach((function(e) {
                (e = v.getMenuItemById("mode-".concat(e))) && (e.enabled = 1 !== t)
            })), k()
        })), a.ipcMain.on("mode-changed", (function(e, t) {
            t = "mode-".concat(t), (t = v.getMenuItemById(t)) && (t.checked = !0), k()
        })), a.ipcMain.on("system-proxy-changed", (function(e, t) {
            var n = v.getMenuItemById("system-proxy");
            n && (n.checked = t), k()
        })), a.ipcMain.on("mixin-changed", (function(e, t) {
            var n = v.getMenuItemById("mixin");
            n && (n.checked = t), k()
        })), a.ipcMain.on("tun-changed", (function(e, t) {
            var n = v.getMenuItemById("tun");
            n && (n.checked = t), k()
        })), a.ipcMain.on("enhanced-tray-click", (function() {
            u.show()
        })), a.ipcMain.on("speed-update", (function(e, t, n) {
            var r = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : "#fff";
            try {
                if (d) {
                    var o, i = a.nativeImage.createFromDataURL(t);
                    if ("win32" === process.platform) {
                        if (60 === n) return void(l && (l.destroy(), l = null, p = 0));
                        var c = i.crop({
                                x: 0,
                                y: 0,
                                width: n + 8,
                                height: 69
                            }),
                            s = w.join(a.app.getPath("temp"), "cfw-sub.html"),
                            u = c.getSize(),
                            h = u.width,
                            f = u.height;
                        m.writeFileSync(s, '\n          <body style="position:relative;background-color:'.concat(r, ';overflow:hidden;-webkit-app-region:drag;margin:0;width:100%;height:100%;box-sizing:border-box;">\n            <img id="img" style="height:100%;width:100%;" src="').concat(c.toDataURL(), '" />\n            <div style="position:absolute;width:50%;height:100%;top:0;left:50%;-webkit-app-region:no-drag;" onclick="handleClick()"></div>\n          </body>\n          <script>\n            const { ipcRenderer } = require(\'electron\');\n            ipcRenderer.on(\'speed-update-win\', (e, url, bgc) => {\n              document.getElementById("img").src = url;\n              document.body.style.backgroundColor = bgc;\n            })\n            const handleClick = () => {\n              ipcRenderer.send(\'enhanced-tray-click\');\n            }\n          <\/script>\n          ')), l || (l = new a.BrowserWindow({
                            show: !0,
                            alwaysOnTop: !0,
                            closable: !1,
                            focusable: !1,
                            frame: !1,
                            useContentSize: !0,
                            maximizable: !1,
                            transparent: !0,
                            minimizable: !1,
                            resizable: !1,
                            webPreferences: {
                                nodeIntegration: !0,
                                contextIsolation: !1
                            }
                        })).loadFile(s), l.show(), l.webContents.send("speed-update-win", c.toDataURL(), r), p !== n && l.setBounds({
                            height: Math.ceil(f / 2.8),
                            width: Math.ceil(h / 2.8)
                        }), p = n
                    }
                    "darwin" === process.platform && ((o = i.crop({
                        x: 0,
                        y: 0,
                        width: n,
                        height: 69
                    }).resize({
                        height: 23
                    })).setTemplateImage(!0), d.setImage(o))
                }
            } catch (e) {}
        }));
        var C, M;
        b = [{
            label: a.app.name,
            submenu: [{
                role: "about"
            }, {
                type: "separator"
            }, {
                role: "services"
            }, {
                type: "separator"
            }, {
                role: "hide"
            }, {
                role: "hideothers"
            }, {
                role: "unhide"
            }, {
                label: "Close",
                accelerator: "Command+W",
                click: function() {
                    u.close()
                }
            }, {
                type: "separator"
            }, {
                label: "退出 Clash for Windows",
                accelerator: "Command+Q",
                click: function() {
                    u.webContents.send("app-exit")
                }
            }]
        }, {
            role: "editMenu"
        }, {
            role: "viewMenu"
        }, {
            role: "windowMenu"
        }, {
            role: "help",
            submenu: [{
                label: "Github",
                click: (M = o()(i.a.mark((function e() {
                    var t;
                    return i.a.wrap((function(e) {
                        for (;;) switch (e.prev = e.next) {
                            case 0:
                                return t = (t = n(0)).shell, e.next = 3, t.openExternal("https://github.com/Fndroid/clash_for_windows_pkg");
                            case 3:
                            case "end":
                                return e.stop()
                        }
                    }), e)
                }))), function() {
                    return M.apply(this, arguments)
                })
            }, {
                label: "Document",
                click: (C = o()(i.a.mark((function e() {
                    var t;
                    return i.a.wrap((function(e) {
                        for (;;) switch (e.prev = e.next) {
                            case 0:
                                return t = (t = n(0)).shell, e.next = 3, t.openExternal("https://docs.cfw.lbyczf.com/");
                            case 3:
                            case "end":
                                return e.stop()
                        }
                    }), e)
                }))), function() {
                    return C.apply(this, arguments)
                })
            }]
        }];
        a.Menu.setApplicationMenu(a.Menu.buildFromTemplate(b))
    }

    function x(e) {
        var t = e.x,
            n = e.y;
        return !a.screen.getAllDisplays().find((function(e) {
            if (i = e.bounds) {
                var r = i.x,
                    o = i.y,
                    i = (e = i.width, i.height);
                return b.inRange(t, r, r + e) && b.inRange(n, o, o + i)
            }
        })) && (e = a.screen.getDisplayNearestPoint({
            x: t,
            y: n
        }).bounds) ? {
            x: e.x,
            y: e.y
        } : {
            x: t,
            y: n
        }
    }
    t = a.app.requestSingleInstanceLock(), a.app.setAppUserModelId("com.lbyczf.clashwin"), a.app.setAsDefaultProtocolClient("clash"), a.app.setName("Clash for Windows"), a.app.setAboutPanelOptions({
        version: ""
    }), a.app.on("open-url", (function(e, t) {
        u.webContents.send("app-open", [t])
    })), t ? (a.app.on("second-instance", (function(e, t, n) {
        u && (u.webContents.send("app-open", t), u.isMinimized() && u.restore(), u.show())
    })), a.app.on("ready", (function() {
        a.powerMonitor.on("shutdown", (function(e) {
            e.preventDefault(), u.webContents.send("app-exit"), setTimeout((function() {
                a.app.isQuiting = !0, a.app.quit()
            }), 5e3)
        })), v()
    }))) : a.app.quit(), a.app.on("activate", (function() {
        null === u ? v() : u.show()
    }))
}, function(e, t, n) {
    e = function(e) {
        "use strict";
        var t, n = Object.prototype,
            r = n.hasOwnProperty,
            o = "function" == typeof Symbol ? Symbol : {},
            i = o.iterator || "@@iterator",
            a = o.asyncIterator || "@@asyncIterator",
            c = o.toStringTag || "@@toStringTag";

        function s(e, t, n) {
            return Object.defineProperty(e, t, {
                value: n,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }), e[t]
        }
        try {
            s({}, "")
        } catch (n) {
            s = function(e, t, n) {
                return e[t] = n
            }
        }

        function u(e, n, r, o) {
            var i, a, c, s;
            n = n && n.prototype instanceof w ? n : w, n = Object.create(n.prototype), o = new _(o || []);
            return n._invoke = (i = e, a = r, c = o, s = p, function(e, n) {
                if (s === h) throw new Error("Generator is already running");
                if (s === f) {
                    if ("throw" === e) throw n;
                    return P()
                }
                for (c.method = e, c.arg = n;;) {
                    var r = c.delegate;
                    if (r) {
                        var o = function e(n, r) {
                            var o;
                            if ((o = n.iterator[r.method]) === t) {
                                if (r.delegate = null, "throw" === r.method) {
                                    if (n.iterator.return && (r.method = "return", r.arg = t, e(n, r), "throw" === r.method)) return g;
                                    r.method = "throw", r.arg = new TypeError("The iterator does not provide a 'throw' method")
                                }
                                return g
                            }
                            return "throw" === (o = l(o, n.iterator, r.arg)).type ? (r.method = "throw", r.arg = o.arg, r.delegate = null, g) : (o = o.arg) ? o.done ? (r[n.resultName] = o.value, r.next = n.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, g) : o : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, g)
                        }(r, c);
                        if (o) {
                            if (o === g) continue;
                            return o
                        }
                    }
                    if ("next" === c.method) c.sent = c._sent = c.arg;
                    else if ("throw" === c.method) {
                        if (s === p) throw s = f, c.arg;
                        c.dispatchException(c.arg)
                    } else "return" === c.method && c.abrupt("return", c.arg);
                    if (s = h, "normal" === (o = l(i, a, c)).type) {
                        if (s = c.done ? f : d, o.arg !== g) return {
                            value: o.arg,
                            done: c.done
                        }
                    } else "throw" === o.type && (s = f, c.method = "throw", c.arg = o.arg)
                }
            }), n
        }

        function l(e, t, n) {
            try {
                return {
                    type: "normal",
                    arg: e.call(t, n)
                }
            } catch (e) {
                return {
                    type: "throw",
                    arg: e
                }
            }
        }
        e.wrap = u;
        var p = "suspendedStart",
            d = "suspendedYield",
            h = "executing",
            f = "completed",
            g = {};

        function w() {}

        function m() {}

        function b() {}
        var y = {};
        y[i] = function() {
            return this
        }, (o = (o = Object.getPrototypeOf) && o(o(O([])))) && o !== n && r.call(o, i) && (y = o);
        var v = b.prototype = w.prototype = Object.create(y);

        function x(e) {
            ["next", "throw", "return"].forEach((function(t) {
                s(e, t, (function(e) {
                    return this._invoke(t, e)
                }))
            }))
        }

        function k(e, t) {
            var n;
            this._invoke = function(o, i) {
                function a() {
                    return new t((function(n, a) {
                        ! function n(o, i, a, c) {
                            if ("throw" !== (o = l(e[o], e, i)).type) {
                                var s = o.arg;
                                return (i = s.value) && "object" == typeof i && r.call(i, "__await") ? t.resolve(i.__await).then((function(e) {
                                    n("next", e, a, c)
                                }), (function(e) {
                                    n("throw", e, a, c)
                                })) : t.resolve(i).then((function(e) {
                                    s.value = e, a(s)
                                }), (function(e) {
                                    return n("throw", e, a, c)
                                }))
                            }
                            c(o.arg)
                        }(o, i, n, a)
                    }))
                }
                return n = n ? n.then(a, a) : a()
            }
        }

        function C(e) {
            var t = {
                tryLoc: e[0]
            };
            1 in e && (t.catchLoc = e[1]), 2 in e && (t.finallyLoc = e[2], t.afterLoc = e[3]), this.tryEntries.push(t)
        }

        function M(e) {
            var t = e.completion || {};
            t.type = "normal", delete t.arg, e.completion = t
        }

        function _(e) {
            this.tryEntries = [{
                tryLoc: "root"
            }], e.forEach(C, this), this.reset(!0)
        }

        function O(e) {
            if (e) {
                if (n = e[i]) return n.call(e);
                if ("function" == typeof e.next) return e;
                if (!isNaN(e.length)) {
                    var n, o = -1;
                    return (n = function n() {
                        for (; ++o < e.length;)
                            if (r.call(e, o)) return n.value = e[o], n.done = !1, n;
                        return n.value = t, n.done = !0, n
                    }).next = n
                }
            }
            return {
                next: P
            }
        }

        function P() {
            return {
                value: t,
                done: !0
            }
        }
        return ((m.prototype = v.constructor = b).constructor = m).displayName = s(b, c, "GeneratorFunction"), e.isGeneratorFunction = function(e) {
            return !!(e = "function" == typeof e && e.constructor) && (e === m || "GeneratorFunction" === (e.displayName || e.name))
        }, e.mark = function(e) {
            return Object.setPrototypeOf ? Object.setPrototypeOf(e, b) : (e.__proto__ = b, s(e, c, "GeneratorFunction")), e.prototype = Object.create(v), e
        }, e.awrap = function(e) {
            return {
                __await: e
            }
        }, x(k.prototype), k.prototype[a] = function() {
            return this
        }, e.AsyncIterator = k, e.async = function(t, n, r, o, i) {
            void 0 === i && (i = Promise);
            var a = new k(u(t, n, r, o), i);
            return e.isGeneratorFunction(n) ? a : a.next().then((function(e) {
                return e.done ? e.value : a.next()
            }))
        }, x(v), s(v, c, "Generator"), v[i] = function() {
            return this
        }, v.toString = function() {
            return "[object Generator]"
        }, e.keys = function(e) {
            var t, n = [];
            for (t in e) n.push(t);
            return n.reverse(),
                function t() {
                    for (; n.length;) {
                        var r = n.pop();
                        if (r in e) return t.value = r, t.done = !1, t
                    }
                    return t.done = !0, t
                }
        }, e.values = O, _.prototype = {
            constructor: _,
            reset: function(e) {
                if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(M), !e)
                    for (var n in this) "t" === n.charAt(0) && r.call(this, n) && !isNaN(+n.slice(1)) && (this[n] = t)
            },
            stop: function() {
                this.done = !0;
                var e = this.tryEntries[0].completion;
                if ("throw" === e.type) throw e.arg;
                return this.rval
            },
            dispatchException: function(e) {
                if (this.done) throw e;
                var n = this;

                function o(r, o) {
                    return c.type = "throw", c.arg = e, n.next = r, o && (n.method = "next", n.arg = t), !!o
                }
                for (var i = this.tryEntries.length - 1; 0 <= i; --i) {
                    var a = this.tryEntries[i],
                        c = a.completion;
                    if ("root" === a.tryLoc) return o("end");
                    if (a.tryLoc <= this.prev) {
                        var s = r.call(a, "catchLoc"),
                            u = r.call(a, "finallyLoc");
                        if (s && u) {
                            if (this.prev < a.catchLoc) return o(a.catchLoc, !0);
                            if (this.prev < a.finallyLoc) return o(a.finallyLoc)
                        } else if (s) {
                            if (this.prev < a.catchLoc) return o(a.catchLoc, !0)
                        } else {
                            if (!u) throw new Error("try statement without catch or finally");
                            if (this.prev < a.finallyLoc) return o(a.finallyLoc)
                        }
                    }
                }
            },
            abrupt: function(e, t) {
                for (var n = this.tryEntries.length - 1; 0 <= n; --n) {
                    var o = this.tryEntries[n];
                    if (o.tryLoc <= this.prev && r.call(o, "finallyLoc") && this.prev < o.finallyLoc) {
                        var i = o;
                        break
                    }
                }
                var a = (i = i && ("break" === e || "continue" === e) && i.tryLoc <= t && t <= i.finallyLoc ? null : i) ? i.completion : {};
                return a.type = e, a.arg = t, i ? (this.method = "next", this.next = i.finallyLoc, g) : this.complete(a)
            },
            complete: function(e, t) {
                if ("throw" === e.type) throw e.arg;
                return "break" === e.type || "continue" === e.type ? this.next = e.arg : "return" === e.type ? (this.rval = this.arg = e.arg, this.method = "return", this.next = "end") : "normal" === e.type && t && (this.next = t), g
            },
            finish: function(e) {
                for (var t = this.tryEntries.length - 1; 0 <= t; --t) {
                    var n = this.tryEntries[t];
                    if (n.finallyLoc === e) return this.complete(n.completion, n.afterLoc), M(n), g
                }
            },
            catch: function(e) {
                for (var t = this.tryEntries.length - 1; 0 <= t; --t) {
                    var n = this.tryEntries[t];
                    if (n.tryLoc === e) {
                        var r, o = n.completion;
                        return "throw" === o.type && (r = o.arg, M(n)), r
                    }
                }
                throw new Error("illegal catch attempt")
            },
            delegateYield: function(e, n, r) {
                return this.delegate = {
                    iterator: O(e),
                    resultName: n,
                    nextLoc: r
                }, "next" === this.method && (this.arg = t), g
            }
        }, e
    }(e.exports);
    try {
        regeneratorRuntime = e
    } catch (t) {
        Function("r", "regeneratorRuntime = r")(e)
    }
}, function(e, t) {
    e.exports = require("fs")
}, function(e, t) {
    e.exports = require("lodash")
}, function(e, t) {
    e.exports = require("fix-path")
}, function(e, t) {
    e.exports = require("electron-window-bounds")
}]);
