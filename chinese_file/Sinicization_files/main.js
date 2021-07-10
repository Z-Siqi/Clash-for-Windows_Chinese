module.exports = function (e) {
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
    return n.m = e, n.c = t, n.d = function (e, t, r) {
        n.o(e, t) || Object.defineProperty(e, t, {
            enumerable: !0,
            get: r
        })
    }, n.r = function (e) {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(e, "__esModule", {
            value: !0
        })
    }, n.t = function (e, t) {
        if (1 & t && (e = n(e)), 8 & t) return e;
        if (4 & t && "object" == typeof e && e && e.__esModule) return e;
        var r = Object.create(null);
        if (n.r(r), Object.defineProperty(r, "default", {
            enumerable: !0,
            value: e
        }), 2 & t && "string" != typeof e)
            for (var o in e) n.d(r, o, function (t) {
                return e[t]
            }.bind(null, o));
        return r
    }, n.n = function (e) {
        var t = e && e.__esModule ? function () {
            return e.default
        } : function () {
            return e
        };
        return n.d(t, "a", t), t
    }, n.o = function (e, t) {
        return Object.prototype.hasOwnProperty.call(e, t)
    }, n.p = "", n(n.s = 5)
}([
    function (e, t) {
        e.exports = require("electron")
    },
    function (e, t, n) {
        e.exports = n(6)
    },
    function (e, t) {
        function n(e, t, n, r, o, i, a) {
            try {
                var c = e[i](a),
                    s = c.value
            } catch (e) {
                return void n(e)
            }
            c.done ? t(s) : Promise.resolve(s).then(r, o)
        }
        e.exports = function (e) {
            return function () {
                var t = this,
                    r = arguments;
                return new Promise((function (o, i) {
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
    },
    function (e, t) {
        e.exports = require("path")
    },
    function (e, t) {
        e.exports = function (e, t, n) {
            return t in e ? Object.defineProperty(e, t, {
                value: n,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }) : e[t] = n, e
        }, e.exports.default = e.exports, e.exports.__esModule = !0
    },
    function (e, t, n) {
        "use strict";
        n.r(t);
        t = n(2);
        var r = n.n(t),
            o = (t = n(4), n.n(t)),
            i = (t = n(1), n.n(t)),
            a = n(0);

        function c(e, t) {
            var n, r = Object.keys(e);
            return Object.getOwnPropertySymbols && (n = Object.getOwnPropertySymbols(e), t && (n = n.filter((function (t) {
                return Object.getOwnPropertyDescriptor(e, t).enumerable
            }))), r.push.apply(r, n)), r
        }

        function s(e) {
            for (var t = 1; t < arguments.length; t++) {
                var n = null != arguments[t] ? arguments[t] : {};
                t % 2 ? c(Object(n), !0).forEach((function (t) {
                    o()(e, t, n[t])
                })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : c(Object(n)).forEach((function (t) {
                    Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t))
                }))
            }
            return e
        }
        var u, l, d, f, p = n(0).TouchBar,
            h = p.TouchBarButton,
            m = n(3),
            g = n(7),
            b = n(8);
        t = n(9);
        n(10).initialize(), global.__static = n(3).join(__dirname, "/static").replace(/\\/g, "\\\\"), t(), a.app.disableHardwareAcceleration(), a.app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors"), "darwin" === process.platform && a.app.dock.hide();
        var y = m.join(a.app.getPath("userData"), "window_ocnfig.json"),
            w = "file://".concat(__dirname, "/index.html");

        function v() {
            var e, t = O().bounds,
                o = void 0 === t ? {} : t;
            (u = new a.BrowserWindow(s({
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
                webPreferences: {
                    nodeIntegration: !0,
                    webSecurity: !0,
                    nodeIntegrationInWorker: !1,
                    enableRemoteModule: !0,
                    contextIsolation: !1,
                    preload: m.resolve(m.join(__dirname, "preload.js"))
                }
            }, o))).setMenu(null), u.webContents.on("will-navigate", (function (e) {
                return e.preventDefault()
            })), u.loadURL(w, {
                userAgent: "ClashforWindows/".concat(a.app.getVersion())
            }), u.on("hide", (function () {
                u.webContents.send("window-event", "hide")
            })), u.on("show", (function () {
                "darwin" === process.platform && a.app.dock.show(), u.webContents.send("window-event", "show"), u.setBounds(E(u.getBounds()))
            })), u.on("close", (function (e) {
                return a.app.isQuiting ? (a.globalShortcut.unregisterAll(), a.app.exit()) : (e.preventDefault(), u.webContents.send("window-event", "close"), u.hide(), "darwin" === process.platform && a.app.dock.hide(), _()), !1
            })), u.on("session-end", (function (e) {
                e.preventDefault(), u.webContents.send("app-exit")
            })), u.webContents.on("render-process-gone", (e = r()(i.a.mark((function e(t, n) {
                var r, o;
                return i.a.wrap((function (e) {
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
            }))), function (t, n) {
                return e.apply(this, arguments)
            })), u.setTouchBar(new p({
                items: [new h({
                    label: "General",
                    backgroundColor: "#505050",
                    click: function () {
                        u.webContents.send("menu-item-change", "general")
                    }
                }), new h({
                    label: "Proxies",
                    backgroundColor: "#505050",
                    click: function () {
                        u.webContents.send("menu-item-change", "proxy")
                    }
                }), new h({
                    label: "Profiles",
                    backgroundColor: "#505050",
                    click: function () {
                        u.webContents.send("menu-item-change", "server")
                    }
                }), new h({
                    label: "Logs",
                    backgroundColor: "#505050",
                    click: function () {
                        u.webContents.send("menu-item-change", "log")
                    }
                }), new h({
                    label: "Connections",
                    backgroundColor: "#505050",
                    click: function () {
                        u.webContents.send("menu-item-change", "connection")
                    }
                }), new h({
                    label: "Settings",
                    backgroundColor: "#505050",
                    click: function () {
                        u.webContents.send("menu-item-change", "setting")
                    }
                }), new h({
                    label: "Feedback",
                    backgroundColor: "#505050",
                    click: function () {
                        u.webContents.send("menu-item-change", "about")
                    }
                })]
            })), a.powerMonitor.on("suspend", (function () {
                u.webContents.send("power-event", "suspend")
            })), a.powerMonitor.on("resume", (function () {
                u.webContents.send("power-event", "resume")
            })), (t = a.nativeImage.createFromPath(n(3).join(__static, "imgs", "logo_64_eyes.png")).resize({
                width: 24,
                height: 24
            })).setTemplateImage(!0), o = m.join(__static, "tray_normal.ico"), (f = new a.Tray("darwin" === process.platform ? t : o)).setToolTip("Clash for Windows"), f.on("click", (function () {
                u.setBounds(E(u.getBounds())), u.show()
            })), a.ipcMain.on("cleanup-done", (function (e) {
                _(), a.app.isQuiting = !0, a.app.quit()
            })), a.ipcMain.on("status-changed", (function (e, t) {
                try {
                    "darwin" !== process.platform && f.setImage(t)
                } catch (e) {}
            })), a.ipcMain.on("show-notification", (function (e, t) {
                var n = m.join(global.__static, "imgs/logo_64.png"),
                    r = new a.Notification(s(s({}, t), {}, {
                        icon: "darwin" !== process.platform ? a.nativeImage.createFromPath(n) : null
                    })),
                    o = (n = t.folder, t.url);
                n && r.on("click", (function () {
                    a.shell.openPath(t.folder)
                })), o && r.on("click", (function () {
                    a.shell.openExternal(o)
                })), r.show()
            }));
            o = [{
                label: "仪表盘",
                click: function () {
                    return u.show()
                }
            }, {
                label: "运行任务栏脚本",
                click: function () {
                    return u.webContents.send("run-tray-script")
                }
            }, {
                type: "separator"
            }, {
                label: "系统代理",
                type: "checkbox",
                id: "system-proxy",
                enabled: !1,
                click: function (e) {
                    e = e.checked, u.webContents.send("system-proxy-changed", e)
                }
            }, {
                label: "混淆",
                type: "checkbox",
                id: "mixin",
                enabled: !1,
                click: function (e) {
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
                click: function () {
                    return u.webContents.send("mode-changed", "global")
                }
            }, {
                label: "规则",
                type: "radio",
                id: "mode-rule",
                enabled: !1,
                click: function () {
                    return u.webContents.send("mode-changed", "rule")
                }
            }, {
                label: "直连",
                type: "radio",
                id: "mode-direct",
                enabled: !1,
                click: function () {
                    return u.webContents.send("mode-changed", "direct")
                }
            }, {
                label: "脚本",
                type: "radio",
                id: "mode-script",
                click: function () {
                    return u.webContents.send("mode-changed", "script")
                }
            }, {
                type: "separator"
            }, {
                label: "更多",
                submenu: [{
                    label: "切换Dev工具",
                    click: function () {
                        u.webContents.toggleDevTools()
                    }
                }, {
                    label: "强制退出",
                    click: function () {
                        a.app.isQuiting = !0, a.app.quit()
                    }
                }]
            }, {
                type: "separator"
            }, {
                label: "退出",
                click: function () {
                    return u.webContents.send("app-exit")
                }
            }];
            var c = a.Menu.buildFromTemplate(o);
            a.ipcMain.on("clash-core-status-change", (function (e, t) {
                var n = c.getMenuItemById("system-proxy");
                n && (n.enabled = 1 !== t), (n = c.getMenuItemById("mixin")) && (n.enabled = 1 !== t), ["global", "rule", "direct", "script"].forEach((function (e) {
                    (e = c.getMenuItemById("mode-".concat(e))) && (e.enabled = 1 !== t)
                }))
            })), a.ipcMain.on("mode-changed", (function (e, t) {
                t = "mode-".concat(t), (t = c.getMenuItemById(t)) && (t.checked = !0)
            })), a.ipcMain.on("system-proxy-changed", (function (e, t) {
                var n = c.getMenuItemById("system-proxy");
                n && (n.checked = t)
            })), a.ipcMain.on("mixin-changed", (function (e, t) {
                var n = c.getMenuItemById("mixin");
                n && (n.checked = t)
            })), a.ipcMain.on("speed-update", (function (e, t, n) {
                var r = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : "#fff";
                try {
                    if (f) {
                        var o, i = a.nativeImage.createFromDataURL(t);
                        if ("win32" === process.platform) {
                            if (60 === n) return void(l && (l.destroy(), l = null, d = 0));
                            var c = i.crop({
                                    x: 0,
                                    y: 0,
                                    width: n + 8,
                                    height: 69
                                }),
                                s = m.join(a.app.getPath("temp"), "cfw-sub.html"),
                                u = c.getSize(),
                                p = u.width,
                                h = u.height;
                            if (g.writeFileSync(s, '\n          <body style="background-color:'.concat(r, ';overflow:hidden;-webkit-app-region:drag;margin:0;width:100%;height:100%;box-sizing:border-box;">\n            <img style="height:100%;width:100%;" src="').concat(c.toDataURL(), '" />\n          </body>\n          ')), !l) {
                                try {
                                    var b = O().subBounds,
                                        y = b.x,
                                        w = b.y
                                } catch (e) {}(l = new a.BrowserWindow({
                                    x: y,
                                    y: w,
                                    show: !0,
                                    alwaysOnTop: !0,
                                    closable: !1,
                                    focusable: !1,
                                    frame: !1,
                                    useContentSize: !0,
                                    maximizable: !1,
                                    transparent: !0,
                                    minimizable: !1,
                                    resizable: !1
                                })).on("moved", (function () {
                                    _()
                                })), l.loadFile(s)
                            }
                            l.show(), l.reload(), d !== n && l.setBounds({
                                height: Math.ceil(h / 2.8),
                                width: Math.ceil(p / 2.8)
                            }), d = n
                        }
                        "darwin" === process.platform && ((o = i.crop({
                            x: 0,
                            y: 0,
                            width: n,
                            height: 69
                        }).resize({
                            height: 23
                        })).setTemplateImage(!0), f.setImage(o))
                    }
                } catch (e) {}
            })), f.on("right-click", (function () {
                f.popUpContextMenu(c)
            }));
            var b, y;
            o = [{
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
                    click: function () {
                        u.close()
                    }
                }, {
                    type: "separator"
                }, {
                    label: "退出 Clash for Windows",
                    accelerator: "Command+Q",
                    click: function () {
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
                    click: (y = r()(i.a.mark((function e() {
                        var t;
                        return i.a.wrap((function (e) {
                            for (;;) switch (e.prev = e.next) {
                            case 0:
                                return t = (t = n(0)).shell, e.next = 3, t.openExternal("https://github.com/Fndroid/clash_for_windows_pkg");
                            case 3:
                            case "end":
                                return e.stop()
                            }
                        }), e)
                    }))), function () {
                        return y.apply(this, arguments)
                    })
                }, {
                    label: "Document",
                    click: (b = r()(i.a.mark((function e() {
                        var t;
                        return i.a.wrap((function (e) {
                            for (;;) switch (e.prev = e.next) {
                            case 0:
                                return t = (t = n(0)).shell, e.next = 3, t.openExternal("https://docs.cfw.lbyczf.com/");
                            case 3:
                            case "end":
                                return e.stop()
                            }
                        }), e)
                    }))), function () {
                        return b.apply(this, arguments)
                    })
                }]
            }];
            a.Menu.setApplicationMenu(a.Menu.buildFromTemplate(o))
        }

        function E(e) {
            var t = e.x,
                n = e.y;
            return !a.screen.getAllDisplays().find((function (e) {
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

        function _() {
            try {
                g.writeFileSync(y, JSON.stringify({
                    bounds: u.getBounds(),
                    subBounds: l ? l.getBounds() : {}
                }))
            } catch (e) {}
        }

        function O() {
            try {
                return JSON.parse(g.readFileSync(y, "utf8"))
            } catch (e) {}
            return {}
        }
        t = a.app.requestSingleInstanceLock(), a.app.setAppUserModelId("com.lbyczf.clashwin"), a.app.setAsDefaultProtocolClient("clash"), a.app.setName("Clash for Windows"), a.app.setAboutPanelOptions({
            version: ""
        }), a.app.on("open-url", (function (e, t) {
            u.webContents.send("app-open", [t])
        })), t ? (a.app.on("second-instance", (function (e, t, n) {
            u && (u.webContents.send("app-open", t), u.isMinimized() && u.restore(), u.show())
        })), a.app.on("ready", (function () {
            a.powerMonitor.on("shutdown", (function (e) {
                e.preventDefault(), u.webContents.send("app-exit"), setTimeout((function () {
                    a.app.isQuiting = !0, a.app.quit()
                }), 5e3)
            })), v()
        }))) : a.app.quit(), a.app.on("activate", (function () {
            null === u ? v() : u.show()
        }))
    },
    function (e, t, n) {
        e = function (e) {
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
                s = function (e, t, n) {
                    return e[t] = n
                }
            }

            function u(e, n, r, o) {
                var i, a, c, s;
                n = n && n.prototype instanceof g ? n : g, n = Object.create(n.prototype), o = new R(o || []);
                return n._invoke = (i = e, a = r, c = o, s = d, function (e, n) {
                    if (s === p) throw new Error("Generator is already running");
                    if (s === h) {
                        if ("throw" === e) throw n;
                        return k()
                    }
                    for (c.method = e, c.arg = n;;) {
                        var r = c.delegate;
                        if (r) {
                            var o = function e(n, r) {
                                var o;
                                if ((o = n.iterator[r.method]) === t) {
                                    if (r.delegate = null, "throw" === r.method) {
                                        if (n.iterator.return && (r.method = "return", r.arg = t, e(n, r), "throw" === r.method)) return m;
                                        r.method = "throw", r.arg = new TypeError("The iterator does not provide a 'throw' method")
                                    }
                                    return m
                                }
                                return "throw" === (o = l(o, n.iterator, r.arg)).type ? (r.method = "throw", r.arg = o.arg, r.delegate = null, m) : (o = o.arg) ? o.done ? (r[n.resultName] = o.value, r.next = n.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, m) : o : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, m)
                            }(r, c);
                            if (o) {
                                if (o === m) continue;
                                return o
                            }
                        }
                        if ("next" === c.method) c.sent = c._sent = c.arg;
                        else if ("throw" === c.method) {
                            if (s === d) throw s = h, c.arg;
                            c.dispatchException(c.arg)
                        } else "return" === c.method && c.abrupt("return", c.arg); if (s = p, "normal" === (o = l(i, a, c)).type) {
                            if (s = c.done ? h : f, o.arg !== m) return {
                                value: o.arg,
                                done: c.done
                            }
                        } else "throw" === o.type && (s = h, c.method = "throw", c.arg = o.arg)
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
            var d = "suspendedStart",
                f = "suspendedYield",
                p = "executing",
                h = "completed",
                m = {};

            function g() {}

            function b() {}

            function y() {}
            var w = {};
            w[i] = function () {
                return this
            }, (o = (o = Object.getPrototypeOf) && o(o(C([])))) && o !== n && r.call(o, i) && (w = o);
            var v = y.prototype = g.prototype = Object.create(w);

            function E(e) {
                ["next", "throw", "return"].forEach((function (t) {
                    s(e, t, (function (e) {
                        return this._invoke(t, e)
                    }))
                }))
            }

            function _(e, t) {
                var n;
                this._invoke = function (o, i) {
                    function a() {
                        return new t((function (n, a) {
                            ! function n(o, i, a, c) {
                                if ("throw" !== (o = l(e[o], e, i)).type) {
                                    var s = o.arg;
                                    return (i = s.value) && "object" == typeof i && r.call(i, "__await") ? t.resolve(i.__await).then((function (e) {
                                        n("next", e, a, c)
                                    }), (function (e) {
                                        n("throw", e, a, c)
                                    })) : t.resolve(i).then((function (e) {
                                        s.value = e, a(s)
                                    }), (function (e) {
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

            function O(e) {
                var t = {
                    tryLoc: e[0]
                };
                1 in e && (t.catchLoc = e[1]), 2 in e && (t.finallyLoc = e[2], t.afterLoc = e[3]), this.tryEntries.push(t)
            }

            function x(e) {
                var t = e.completion || {};
                t.type = "normal", delete t.arg, e.completion = t
            }

            function R(e) {
                this.tryEntries = [{
                    tryLoc: "root"
                }], e.forEach(O, this), this.reset(!0)
            }

            function C(e) {
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
                    next: k
                }
            }

            function k() {
                return {
                    value: t,
                    done: !0
                }
            }
            return ((b.prototype = v.constructor = y).constructor = b).displayName = s(y, c, "GeneratorFunction"), e.isGeneratorFunction = function (e) {
                return !!(e = "function" == typeof e && e.constructor) && (e === b || "GeneratorFunction" === (e.displayName || e.name))
            }, e.mark = function (e) {
                return Object.setPrototypeOf ? Object.setPrototypeOf(e, y) : (e.__proto__ = y, s(e, c, "GeneratorFunction")), e.prototype = Object.create(v), e
            }, e.awrap = function (e) {
                return {
                    __await: e
                }
            }, E(_.prototype), _.prototype[a] = function () {
                return this
            }, e.AsyncIterator = _, e.async = function (t, n, r, o, i) {
                void 0 === i && (i = Promise);
                var a = new _(u(t, n, r, o), i);
                return e.isGeneratorFunction(n) ? a : a.next().then((function (e) {
                    return e.done ? e.value : a.next()
                }))
            }, E(v), s(v, c, "Generator"), v[i] = function () {
                return this
            }, v.toString = function () {
                return "[object Generator]"
            }, e.keys = function (e) {
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
            }, e.values = C, R.prototype = {
                constructor: R,
                reset: function (e) {
                        if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(x), !e)
                            for (var n in this) "t" === n.charAt(0) && r.call(this, n) && !isNaN(+n.slice(1)) && (this[n] = t)
                    }, stop: function () {
                        this.done = !0;
                        var e = this.tryEntries[0].completion;
                        if ("throw" === e.type) throw e.arg;
                        return this.rval
                    }, dispatchException: function (e) {
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
                    }, abrupt: function (e, t) {
                        for (var n = this.tryEntries.length - 1; 0 <= n; --n) {
                            var o = this.tryEntries[n];
                            if (o.tryLoc <= this.prev && r.call(o, "finallyLoc") && this.prev < o.finallyLoc) {
                                var i = o;
                                break
                            }
                        }
                        var a = (i = i && ("break" === e || "continue" === e) && i.tryLoc <= t && t <= i.finallyLoc ? null : i) ? i.completion : {};
                        return a.type = e, a.arg = t, i ? (this.method = "next", this.next = i.finallyLoc, m) : this.complete(a)
                    }, complete: function (e, t) {
                        if ("throw" === e.type) throw e.arg;
                        return "break" === e.type || "continue" === e.type ? this.next = e.arg : "return" === e.type ? (this.rval = this.arg = e.arg, this.method = "return", this.next = "end") : "normal" === e.type && t && (this.next = t), m
                    }, finish: function (e) {
                        for (var t = this.tryEntries.length - 1; 0 <= t; --t) {
                            var n = this.tryEntries[t];
                            if (n.finallyLoc === e) return this.complete(n.completion, n.afterLoc), x(n), m
                        }
                    },
                    catch: function (e) {
                        for (var t = this.tryEntries.length - 1; 0 <= t; --t) {
                            var n = this.tryEntries[t];
                            if (n.tryLoc === e) {
                                var r, o = n.completion;
                                return "throw" === o.type && (r = o.arg, x(n)), r
                            }
                        }
                        throw new Error("illegal catch attempt")
                    }, delegateYield: function (e, n, r) {
                        return this.delegate = {
                            iterator: C(e),
                            resultName: n,
                            nextLoc: r
                        }, "next" === this.method && (this.arg = t), m
                    }
            }, e
        }(e.exports);
        try {
            regeneratorRuntime = e
        } catch (t) {
            Function("r", "regeneratorRuntime = r")(e)
        }
    },
    function (e, t) {
        e.exports = require("fs")
    },
    function (e, t) {
        e.exports = require("lodash")
    },
    function (e, t) {
        e.exports = require("fix-path")
    },
    function (e, t, n) {
        e.exports = n(11)
    },
    function (e, t, n) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        }), t.initialize = void 0;
        var r = n(12);
        Object.defineProperty(t, "initialize", {
            enumerable: !0,
            get: function () {
                return r.initialize
            }
        })
    },
    function (e, t, n) {
        "use strict";
        var r = this && this.__importDefault || function (e) {
            return e && e.__esModule ? e : {
                default: e
            }
        };
        Object.defineProperty(t, "__esModule", {
            value: !0
        }), t.initialize = t.isRemoteModuleEnabled = void 0;
        const o = n(13),
            i = r(n(14)),
            a = n(15),
            c = n(0),
            s = n(16).getElectronBinding("v8_util"),
            u = ["length", "name", "arguments", "caller", "prototype"],
            l = new Map,
            d = new FinalizationRegistry(e => {
                var t = e.id[0] + "~" + e.id[1];
                const n = l.get(t);
                if (void 0 !== n && void 0 === n.deref() && (l.delete(t), !e.webContents.isDestroyed())) try {
                    e.webContents.sendToFrame(e.frameId, "REMOTE_RENDERER_RELEASE_CALLBACK", e.id[0], e.id[1])
                } catch (e) {
                    console.warn("sendToFrame() failed: " + e)
                }
            });

        function f(e) {
            e = e[0] + "~" + e[1];
            const t = l.get(e);
            if (void 0 !== t && void 0 !== (e = t.deref())) return e
        }
        const p = new WeakMap,
            h = function (e) {
                let t = Object.getOwnPropertyNames(e);
                return "function" == typeof e && (t = t.filter(e => !u.includes(e))), t.map(t => {
                    var n = Object.getOwnPropertyDescriptor(e, t);
                    let r, o = !1;
                    return r = void 0 === n.get && "function" == typeof e[t] ? "method" : ((n.set || n.writable) && (o = !0), "get"), {
                        name: t,
                        enumerable: n.enumerable,
                        writable: o,
                        type: r
                    }
                })
            },
            m = function (e) {
                return null === (e = Object.getPrototypeOf(e)) || e === Object.prototype ? null : {
                    members: h(e),
                    proto: m(e)
                }
            },
            g = function (e, t, n, r = !1) {
                let o;
                switch (typeof n) {
                case "object":
                    o = n instanceof Buffer ? "buffer" : n && n.constructor && "NativeImage" === n.constructor.name ? "nativeimage" : Array.isArray(n) ? "array" : n instanceof Error ? "error" : a.isSerializableObject(n) ? "value" : a.isPromise(n) ? "promise" : Object.prototype.hasOwnProperty.call(n, "callee") && null != n.length ? "array" : r && s.getHiddenValue(n, "simple") ? "value" : "object";
                    break;
                case "function":
                    o = "function";
                    break;
                default:
                    o = "value"
                }
                return "array" === o ? {
                    type: o,
                    members: n.map(n => g(e, t, n, r))
                } : "nativeimage" === o ? {
                    type: o,
                    value: a.serialize(n)
                } : "object" === o || "function" === o ? {
                    type: o,
                    name: n.constructor ? n.constructor.name : "",
                    id: i.default.add(e, t, n),
                    members: h(n),
                    proto: m(n)
                } : "buffer" === o ? {
                    type: o,
                    value: n
                } : "promise" === o ? (n.then((function () {}), (function () {})), {
                    type: o,
                    then: g(e, t, (function (e, t) {
                        n.then(e, t)
                    }))
                }) : "error" === o ? {
                    type: o,
                    value: n,
                    members: Object.keys(n).map(r => ({
                        name: r,
                        value: g(e, t, n[r])
                    }))
                } : {
                    type: "value",
                    value: n
                }
            },
            b = function (e) {
                const t = new Error(e);
                throw t.code = "EBADRPC", t.errno = -72, t
            },
            y = (e, t) => {
                let n = "Attempting to call a function in a renderer window that has been closed or released.\nFunction provided here: " + p.get(t);
                if (e instanceof o.EventEmitter) {
                    const r = e.eventNames().filter(n => e.listeners(n).includes(t));
                    0 < r.length && (n += "\nRemote event names: " + r.join(", "), r.forEach(n => {
                        e.removeListener(n, t)
                    }))
                }
                console.warn(n)
            },
            w = function (e, t, n, r) {
                const o = function (r) {
                    switch (r.type) {
                    case "nativeimage":
                        return a.deserialize(r.value);
                    case "value":
                        return r.value;
                    case "remote-object":
                        return i.default.get(r.id);
                    case "array":
                        return w(e, t, n, r.value);
                    case "buffer":
                        return Buffer.from(r.value.buffer, r.value.byteOffset, r.value.byteLength);
                    case "promise":
                        return Promise.resolve({
                            then: o(r.then)
                        });
                    case "object":
                        {
                            const e = "Object" !== r.name ? Object.create({
                                constructor: (_ = r.name, new Proxy(Object, {
                                    get: (e, t, n) => "name" === t ? _ : Reflect.get(e, t, n)
                                }))
                            }) : {};
                            for (var {
                                    name: c,
                                    value: s
                                }
                                of r.members) e[c] = o(s);
                            return e
                        }
                    case "function-with-return-value":
                        {
                            const e = o(r.value);
                            return function () {
                                return e
                            }
                        }
                    case "function":
                        {
                            var u = [n, r.id],
                                h = f(u);
                            if (void 0 !== h) return h;
                            const o = function (...i) {
                                let a = !1;
                                if (!e.isDestroyed()) try {
                                    a = !1 !== e.sendToFrame(t, "REMOTE_RENDERER_CALLBACK", n, r.id, g(e, n, i))
                                } catch (i) {
                                    console.warn("sendToFrame() failed: " + i)
                                }
                                a || y(this, o)
                            };
                            return p.set(o, r.location), Object.defineProperty(o, "length", {
                                value: r.length
                            }), m = u, b = e, v = t, E = o, h = new WeakRef(E), u = m[0] + "~" + m[1], l.set(u, h), d.register(E, {
                                id: m,
                                webContents: b,
                                frameId: v
                            }), o
                        }
                    default:
                        throw new TypeError("Unknown type: " + r.type)
                    }
                    var m, b, v, E, _
                };
                return r.map(o)
            },
            v = new WeakMap;
        t.isRemoteModuleEnabled = function (e) {
            return v.has(e) || v.set(e, function (e) {
                return null != (e = e.getLastWebPreferences() || {}).enableRemoteModule && !!e.enableRemoteModule
            }(e)), v.get(e)
        };
        const E = function (e, n) {
                c.ipcMain.on(e, (e, r, ...o) => {
                    let i;
                    if (t.isRemoteModuleEnabled(e.sender)) {
                        try {
                            i = n(e, r, ...o)
                        } catch (o) {
                            i = {
                                type: "exception",
                                value: g(e.sender, r, o)
                            }
                        }
                        void 0 !== i && (e.returnValue = i)
                    } else e.returnValue = {
                        type: "exception",
                        value: g(e.sender, r, new Error("@electron/remote is disabled for this WebContents. Set {enableRemoteModule: true} in WebPreferences to enable it."))
                    }
                })
            },
            _ = function (e, t, ...n) {
                var r = {
                    sender: e,
                    returnValue: void 0,
                    defaultPrevented: !1
                };
                return c.app.emit(t, r, e, ...n), e.emit(t, r, ...n), r
            },
            O = function (e, t, n) {
                n && console.warn(`WebContents (${e.id}): ${t}`, n)
            };
        let x = !1;
        t.initialize = function () {
            if (x) throw new Error("electron-remote has already been initialized");
            x = !0, E("REMOTE_BROWSER_WRONG_CONTEXT_ERROR", (function (e, t, n, r) {
                void 0 !== (r = f([n, r])) && y(e.sender, r)
            })), E("REMOTE_BROWSER_REQUIRE", (function (e, t, n, r) {
                O(e.sender, `remote.require('${n}')`, r);
                const o = _(e.sender, "remote-require", n);
                if (void 0 === o.returnValue) {
                    if (o.defaultPrevented) throw new Error(`Blocked remote.require('${n}')`);
                    o.returnValue = process.mainModule.require(n)
                }
                return g(e.sender, t, o.returnValue)
            })), E("REMOTE_BROWSER_GET_BUILTIN", (function (e, t, r, o) {
                O(e.sender, `remote.getBuiltin('${r}')`, o);
                const i = _(e.sender, "remote-get-builtin", r);
                if (void 0 === i.returnValue) {
                    if (i.defaultPrevented) throw new Error(`Blocked remote.getBuiltin('${r}')`);
                    i.returnValue = n(0)[r]
                }
                return g(e.sender, t, i.returnValue)
            })), E("REMOTE_BROWSER_GET_GLOBAL", (function (e, t, n, r) {
                O(e.sender, `remote.getGlobal('${n}')`, r);
                const o = _(e.sender, "remote-get-global", n);
                if (void 0 === o.returnValue) {
                    if (o.defaultPrevented) throw new Error(`Blocked remote.getGlobal('${n}')`);
                    o.returnValue = global[n]
                }
                return g(e.sender, t, o.returnValue)
            })), E("REMOTE_BROWSER_GET_CURRENT_WINDOW", (function (e, t, n) {
                O(e.sender, "remote.getCurrentWindow()", n);
                const r = _(e.sender, "remote-get-current-window");
                if (void 0 === r.returnValue) {
                    if (r.defaultPrevented) throw new Error("Blocked remote.getCurrentWindow()");
                    r.returnValue = e.sender.getOwnerBrowserWindow()
                }
                return g(e.sender, t, r.returnValue)
            })), E("REMOTE_BROWSER_GET_CURRENT_WEB_CONTENTS", (function (e, t, n) {
                O(e.sender, "remote.getCurrentWebContents()", n);
                const r = _(e.sender, "remote-get-current-web-contents");
                if (void 0 === r.returnValue) {
                    if (r.defaultPrevented) throw new Error("Blocked remote.getCurrentWebContents()");
                    r.returnValue = e.sender
                }
                return g(e.sender, t, r.returnValue)
            })), E("REMOTE_BROWSER_CONSTRUCTOR", (function (e, t, n, r) {
                r = w(e.sender, e.frameId, t, r);
                const o = i.default.get(n);
                return null == o && b("Cannot call constructor on missing remote object " + n), g(e.sender, t, new o(...r))
            })), E("REMOTE_BROWSER_FUNCTION_CALL", (function (e, t, n, r) {
                r = w(e.sender, e.frameId, t, r);
                const o = i.default.get(n);
                null == o && b("Cannot call function on missing remote object " + n);
                try {
                    return g(e.sender, t, o(...r), !0)
                } catch (e) {
                    const t = new Error(`Could not call remote function '${o.name||"anonymous"}'. Check that the function signature is correct. Underlying error: ${e.message}\nUnderlying stack: ${e.stack}\n`);
                    throw t.cause = e, t
                }
            })), E("REMOTE_BROWSER_MEMBER_CONSTRUCTOR", (function (e, t, n, r, o) {
                o = w(e.sender, e.frameId, t, o);
                const a = i.default.get(n);
                return null == a && b(`Cannot call constructor '${r}' on missing remote object ${n}`), g(e.sender, t, new a[r](...o))
            })), E("REMOTE_BROWSER_MEMBER_CALL", (function (e, t, n, r, o) {
                o = w(e.sender, e.frameId, t, o);
                const a = i.default.get(n);
                null == a && b(`Cannot call method '${r}' on missing remote object ${n}`);
                try {
                    return g(e.sender, t, a[r](...o), !0)
                } catch (e) {
                    const t = new Error(`Could not call remote method '${r}'. Check that the method signature is correct. Underlying error: ${e.message}\nUnderlying stack: ${e.stack}\n`);
                    throw t.cause = e, t
                }
            })), E("REMOTE_BROWSER_MEMBER_SET", (function (e, t, n, r, o) {
                o = w(e.sender, e.frameId, t, o);
                const a = i.default.get(n);
                return null == a && b(`Cannot set property '${r}' on missing remote object ${n}`), a[r] = o[0], null
            })), E("REMOTE_BROWSER_MEMBER_GET", (function (e, t, n, r) {
                var o = i.default.get(n);
                return null == o && b(`Cannot get property '${r}' on missing remote object ${n}`), g(e.sender, t, o[r])
            })), E("REMOTE_BROWSER_DEREFERENCE", (function (e, t, n) {
                i.default.remove(e.sender, t, n)
            })), E("REMOTE_BROWSER_CONTEXT_RELEASE", (e, t) => (i.default.clear(e.sender, t), null))
        }
    },
    function (e, t) {
        e.exports = require("events")
    },
    function (e, t, n) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        });
        const r = (e, t) => `${e.id}-${t}`;
        t.default = new class {
            constructor() {
                this.nextId = 0, this.storage = {}, this.owners = {}, this.electronIds = new WeakMap
            }
            add(e, t, n) {
                var o = this.saveToStorage(n);
                n = r(e, t);
                let i = this.owners[n];
                return i || (i = this.owners[n] = new Map, this.registerDeleteListener(e, t)), i.has(o) || (i.set(o, 0), this.storage[o].count++), i.set(o, i.get(o) + 1), o
            }
            get(e) {
                if (null != (e = this.storage[e])) return e.object
            }
            remove(e, t, n) {
                t = r(e, t);
                const o = this.owners[t];
                o && o.has(n) && ((t = o.get(n) - 1) <= 0 ? (o.delete(n), this.dereference(n)) : o.set(n, t))
            }
            clear(e, t) {
                t = r(e, t);
                const n = this.owners[t];
                if (n) {
                    for (const e of n.keys()) this.dereference(e);
                    delete this.owners[t]
                }
            }
            saveToStorage(e) {
                let t = this.electronIds.get(e);
                return t || (t = ++this.nextId, this.storage[t] = {
                    count: 0,
                    object: e
                }, this.electronIds.set(e, t)), t
            }
            dereference(e) {
                const t = this.storage[e];
                null != t && (--t.count, 0 === t.count && (this.electronIds.delete(t.object), delete this.storage[e]))
            }
            registerDeleteListener(e, t) {
                const n = t.split("-")[0],
                    r = (o, i) => {
                        i && i.toString() === n && (e.removeListener("render-view-deleted", r), this.clear(e, t))
                    };
                e.on("render-view-deleted", r)
            }
        }
    },
    function (e, t, n) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        }), t.deserialize = t.serialize = t.isSerializableObject = t.isPromise = void 0;
        const r = n(0);
        t.isPromise = function (e) {
            return e && e.then && e.then instanceof Function && e.constructor && e.constructor.reject && e.constructor.reject instanceof Function && e.constructor.resolve && e.constructor.resolve instanceof Function
        };
        const o = [Boolean, Number, String, Date, Error, RegExp, ArrayBuffer];

        function i(e) {
            return null === e || ArrayBuffer.isView(e) || o.some(t => e instanceof t)
        }
        t.isSerializableObject = i;
        const a = function (e, t) {
            return e = Object.entries(e).map(([e, n]) => [e, t(n)]), Object.fromEntries(e)
        };
        t.serialize = function e(t) {
            return t && t.constructor && "NativeImage" === t.constructor.name ? function (e) {
                const t = [];
                var n = e.getScaleFactors();
                if (1 === n.length) {
                    var r = n[0],
                        o = e.getSize(r),
                        i = e.toBitmap({
                            scaleFactor: r
                        });
                    t.push({
                        scaleFactor: r,
                        size: o,
                        buffer: i
                    })
                } else
                    for (const r of n) {
                        var a = e.getSize(r),
                            c = e.toDataURL({
                                scaleFactor: r
                            });
                        t.push({
                            scaleFactor: r,
                            size: a,
                            dataURL: c
                        })
                    }
                return {
                    __ELECTRON_SERIALIZED_NativeImage__: !0,
                    representations: t
                }
            }(t) : Array.isArray(t) ? t.map(e) : !i(t) && t instanceof Object ? a(t, e) : t
        }, t.deserialize = function e(t) {
            return t && t.__ELECTRON_SERIALIZED_NativeImage__ ? function (e) {
                const t = r.nativeImage.createEmpty();
                if (1 === e.representations.length) {
                    var {
                        buffer: n,
                        size: o,
                        scaleFactor: i
                    } = e.representations[0], {
                        width: a,
                        height: o
                    } = o;
                    t.addRepresentation({
                        buffer: n,
                        scaleFactor: i,
                        width: a,
                        height: o
                    })
                } else
                    for (const n of e.representations) {
                        var {
                            dataURL: c,
                            size: s,
                            scaleFactor: u
                        } = n, {
                            width: l,
                            height: s
                        } = s;
                        t.addRepresentation({
                            dataURL: c,
                            scaleFactor: u,
                            width: l,
                            height: s
                        })
                    }
                return t
            }(t) : Array.isArray(t) ? t.map(e) : !i(t) && t instanceof Object ? a(t, e) : t
        }
    },
    function (e, t, n) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        }), t.getElectronBinding = void 0, t.getElectronBinding = e => process._linkedBinding ? process._linkedBinding("electron_common_" + e) : process.electronBinding ? process.electronBinding(e) : null
    }
]);
