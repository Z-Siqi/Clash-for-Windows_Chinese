module.exports = function (e) {
    function t(r) {
        if (n[r]) return n[r].exports;
        var o = n[r] = {
            i: r,
            l: !1,
            exports: {}
        };
        return e[r].call(o.exports, o, o.exports, t), o.l = !0, o.exports
    }
    var n = {};
    return t.m = e, t.c = n, t.d = function (e, n, r) {
        t.o(e, n) || Object.defineProperty(e, n, {
            enumerable: !0,
            get: r
        })
    }, t.r = function (e) {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(e, "__esModule", {
            value: !0
        })
    }, t.t = function (e, n) {
        if (1 & n && (e = t(e)), 8 & n) return e;
        if (4 & n && "object" == typeof e && e && e.__esModule) return e;
        var r = Object.create(null);
        if (t.r(r), Object.defineProperty(r, "default", {
            enumerable: !0,
            value: e
        }), 2 & n && "string" != typeof e)
            for (var o in e) t.d(r, o, function (t) {
                return e[t]
            }.bind(null, o));
        return r
    }, t.n = function (e) {
        var n = e && e.__esModule ? function () {
            return e.default
        } : function () {
            return e
        };
        return t.d(n, "a", n), n
    }, t.o = function (e, t) {
        return Object.prototype.hasOwnProperty.call(e, t)
    }, t.p = "", t(t.s = 5)
}([
    function (e) {
        e.exports = require("electron")
    },
    function (e, t, n) {
        e.exports = n(6)
    },
    function (e) {
        function t(e, t, n, r, o, i, a) {
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
                var n = this,
                    r = arguments;
                return new Promise((function (o, i) {
                    function a(e) {
                        t(s, o, i, a, c, "next", e)
                    }

                    function c(e) {
                        t(s, o, i, a, c, "throw", e)
                    }
                    var s = e.apply(n, r);
                    a(void 0)
                }))
            }
        }
    },
    function (e) {
        e.exports = require("path")
    },
    function (e) {
        e.exports = function (e, t, n) {
            return t in e ? Object.defineProperty(e, t, {
                value: n,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }) : e[t] = n, e
        }
    },
    function (e, t, n) {
        "use strict";

        function r(e, t) {
            var n = Object.keys(e);
            if (Object.getOwnPropertySymbols) {
                var r = Object.getOwnPropertySymbols(e);
                t && (r = r.filter((function (t) {
                    return Object.getOwnPropertyDescriptor(e, t).enumerable
                }))), n.push.apply(n, r)
            }
            return n
        }

        function o(e) {
            for (var t, n = 1; n < arguments.length; n++) t = null == arguments[n] ? {} : arguments[n], n % 2 ? r(Object(t), !0).forEach((function (n) {
                h()(e, n, t[n])
            })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : r(Object(t)).forEach((function (n) {
                Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(t, n))
            }));
            return e
        }

        function i() {
            var e = s().bounds,
                t = void 0 === e ? {} : e;
            (_ = new m.BrowserWindow(o({
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
                    preload: y.resolve(y.join(__dirname, "preload.js"))
                }
            }, t))).setMenu(null), _.webContents.on("will-navigate", (function (e) {
                return e.preventDefault()
            })), _.loadURL(k, {
                userAgent: "ClashforWindows/".concat(m.app.getVersion())
            }), _.on("hide", (function () {
                _.webContents.send("window-event", "hide")
            })), _.on("show", (function () {
                "darwin" === process.platform && m.app.dock.show(), _.webContents.send("window-event", "show"), _.setBounds(a(_.getBounds()))
            })), _.on("close", (function (e) {
                return m.app.isQuiting ? (m.globalShortcut.unregisterAll(), m.app.exit()) : (e.preventDefault(), _.webContents.send("window-event", "close"), _.hide(), "darwin" === process.platform && m.app.dock.hide(), c()), !1
            })), _.on("session-end", (function (e) {
                e.preventDefault(), _.webContents.send("app-exit")
            })), _.webContents.on("render-process-gone", function () {
                var e = f()(l.a.mark((function e(t, n) {
                    var r, o, i;
                    return l.a.wrap((function (e) {
                        for (;;) switch (e.prev = e.next) {
                        case 0:
                            if (r = n.reason, "darwin" !== process.platform) {
                                e.next = 3;
                                break
                            }
                            return e.abrupt("return");
                        case 3:
                            if ("crashed" !== r) {
                                e.next = 10;
                                break
                            }
                            return o = {
                                type: "error",
                                title: "Clash for Windows",
                                message: "Dashboard has crashed!",
                                buttons: ["Reload", "Exit"]
                            }, e.next = 7, m.dialog.showMessageBox(_, o);
                        case 7:
                            i = e.sent, 0 === i.response ? (m.app.relaunch(), m.app.exit(0)) : m.app.quit();
                        case 10:
                        case "end":
                            return e.stop()
                        }
                    }), e)
                })));
                return function () {
                    return e.apply(this, arguments)
                }
            }()), _.setTouchBar(new g({
                items: [new b({
                    label: "General",
                    backgroundColor: "#505050",
                    click: function () {
                        _.webContents.send("menu-item-change", "general")
                    }
                }), new b({
                    label: "Proxies",
                    backgroundColor: "#505050",
                    click: function () {
                        _.webContents.send("menu-item-change", "proxy")
                    }
                }), new b({
                    label: "Profiles",
                    backgroundColor: "#505050",
                    click: function () {
                        _.webContents.send("menu-item-change", "server")
                    }
                }), new b({
                    label: "Logs",
                    backgroundColor: "#505050",
                    click: function () {
                        _.webContents.send("menu-item-change", "log")
                    }
                }), new b({
                    label: "Connections",
                    backgroundColor: "#505050",
                    click: function () {
                        _.webContents.send("menu-item-change", "connection")
                    }
                }), new b({
                    label: "Settings",
                    backgroundColor: "#505050",
                    click: function () {
                        _.webContents.send("menu-item-change", "setting")
                    }
                }), new b({
                    label: "Feedback",
                    backgroundColor: "#505050",
                    click: function () {
                        _.webContents.send("menu-item-change", "about")
                    }
                })]
            })), m.powerMonitor.on("suspend", (function () {
                _.webContents.send("power-event", "suspend")
            })), m.powerMonitor.on("resume", (function () {
                _.webContents.send("power-event", "resume")
            }));
            var r = m.nativeImage.createFromPath(n(3).join(__static, "imgs", "logo_64_eyes.png")).resize({
                width: 24,
                height: 24
            });
            r.setTemplateImage(!0);
            var i = y.join(__static, "tray_normal.ico");
            (x = new m.Tray("darwin" === process.platform ? r : i)).setToolTip("Clash for Windows"), x.on("click", (function () {
                _.setBounds(a(_.getBounds())), _.show()
            })), m.ipcMain.on("cleanup-done", (function () {
                c(), m.app.isQuiting = !0, m.app.quit()
            })), m.ipcMain.on("status-changed", (function (e, t) {
                try {
                    "darwin" !== process.platform && x.setImage(t)
                } catch (t) {}
            })), m.ipcMain.on("show-notification", (function (e, t) {
                var n = y.join(global.__static, "imgs/logo_64.png"),
                    r = new m.Notification(o(o({}, t), {}, {
                        icon: "darwin" === process.platform ? null : m.nativeImage.createFromPath(n)
                    })),
                    i = t.folder,
                    a = t.url;
                i && r.on("click", (function () {
                    m.shell.openPath(t.folder)
                })), a && r.on("click", (function () {
                    m.shell.openExternal(a)
                })), r.show()
            }));
            var u = m.Menu.buildFromTemplate([{
                label: "仪表盘",
                click: function () {
                    return _.show()
                }
            }, {
                label: "运行任务栏脚本",
                click: function () {
                    return _.webContents.send("run-tray-script")
                }
            }, {
                type: "separator"
            }, {
                label: "系统代理",
                type: "checkbox",
                id: "system-proxy",
                enabled: !1,
                click: function (e) {
                    var t = e.checked;
                    _.webContents.send("system-proxy-changed", t)
                }
            }, {
                label: "混淆",
                type: "checkbox",
                id: "mixin",
                enabled: !1,
                click: function (e) {
                    var t = e.checked;
                    _.webContents.send("mixin-changed", t)
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
                    return _.webContents.send("mode-changed", "global")
                }
            }, {
                label: "规则",
                type: "radio",
                id: "mode-rule",
                enabled: !1,
                click: function () {
                    return _.webContents.send("mode-changed", "rule")
                }
            }, {
                label: "直连",
                type: "radio",
                id: "mode-direct",
                enabled: !1,
                click: function () {
                    return _.webContents.send("mode-changed", "direct")
                }
            }, {
                label: "脚本",
                type: "radio",
                id: "mode-script",
                click: function () {
                    return _.webContents.send("mode-changed", "script")
                }
            }, {
                type: "separator"
            }, {
                label: "更多",
                submenu: [{
                    label: "切换DevTools",
                    click: function () {
                        _.webContents.toggleDevTools()
                    }
                }, {
                    label: "强制退出",
                    click: function () {
                        m.app.isQuiting = !0, m.app.quit()
                    }
                }]
            }, {
                type: "separator"
            }, {
                label: "退出",
                click: function () {
                    return _.webContents.send("app-exit")
                }
            }]);
            m.ipcMain.on("clash-core-status-change", (function (e, t) {
                var n = u.getMenuItemById("system-proxy");
                n && (n.enabled = 1 !== t);
                var r = u.getMenuItemById("mixin");
                r && (r.enabled = 1 !== t), ["global", "rule", "direct", "script"].forEach((function (e) {
                    var n = u.getMenuItemById("mode-".concat(e));
                    n && (n.enabled = 1 !== t)
                }))
            })), m.ipcMain.on("mode-changed", (function (e, t) {
                var n = "mode-".concat(t),
                    r = u.getMenuItemById(n);
                r && (r.checked = !0)
            })), m.ipcMain.on("system-proxy-changed", (function (e, t) {
                var n = u.getMenuItemById("system-proxy");
                n && (n.checked = t)
            })), m.ipcMain.on("mixin-changed", (function (e, t) {
                var n = u.getMenuItemById("mixin");
                n && (n.checked = t)
            })), m.ipcMain.on("speed-update", (function (e, t, n) {
                var r = Math.ceil,
                    o = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : "#fff";
                try {
                    if (x) {
                        var i = m.nativeImage.createFromDataURL(t);
                        if ("win32" === process.platform) {
                            if (60 === n) return void(O && (O.destroy(), O = null, R = 0));
                            var a = i.crop({
                                    x: 0,
                                    y: 0,
                                    width: n + 8,
                                    height: 69
                                }),
                                u = y.join(m.app.getPath("temp"), "cfw-sub.html"),
                                l = a.getSize(),
                                d = l.width,
                                f = l.height;
                            if (w.writeFileSync(u, '\n          <body style="background-color:'.concat(o, ';overflow:hidden;-webkit-app-region:drag;margin:0;width:100%;height:100%;box-sizing:border-box;">\n            <img style="height:100%;width:100%;" src="').concat(a.toDataURL(), '" />\n          </body>\n          ')), !O) {
                                var p, h;
                                try {
                                    var g = s(),
                                        b = g.subBounds;
                                    p = b.x, h = b.y
                                } catch (t) {}(O = new m.BrowserWindow({
                                    x: p,
                                    y: h,
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
                                    c()
                                })), O.loadFile(u)
                            }
                            O.show(), O.reload(), R !== n && O.setBounds({
                                height: r(f / 2.8),
                                width: r(d / 2.8)
                            }), R = n
                        }
                        if ("darwin" === process.platform) {
                            var v = i.crop({
                                x: 0,
                                y: 0,
                                width: n,
                                height: 69
                            }).resize({
                                height: 23
                            });
                            v.setTemplateImage(!0), x.setImage(v)
                        }
                    }
                } catch (t) {}
            })), x.on("right-click", (function () {
                x.popUpContextMenu(u)
            }));
            var d = [{
                label: m.app.name,
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
                        _.close()
                    }
                }, {
                    type: "separator"
                }, {
                    label: "退出 Clash for Windows",
                    accelerator: "Command+Q",
                    click: function () {
                        _.webContents.send("app-exit")
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
                    click: function () {
                        var e = f()(l.a.mark((function e() {
                            var t, r;
                            return l.a.wrap((function (e) {
                                for (;;) switch (e.prev = e.next) {
                                case 0:
                                    return t = n(0), r = t.shell, e.next = 3, r.openExternal("https://github.com/Fndroid/clash_for_windows_pkg");
                                case 3:
                                case "end":
                                    return e.stop()
                                }
                            }), e)
                        })));
                        return function () {
                            return e.apply(this, arguments)
                        }
                    }()
                }, {
                    label: "Document",
                    click: function () {
                        var e = f()(l.a.mark((function e() {
                            var t, r;
                            return l.a.wrap((function (e) {
                                for (;;) switch (e.prev = e.next) {
                                case 0:
                                    return t = n(0), r = t.shell, e.next = 3, r.openExternal("https://docs.cfw.lbyczf.com/");
                                case 3:
                                case "end":
                                    return e.stop()
                                }
                            }), e)
                        })));
                        return function () {
                            return e.apply(this, arguments)
                        }
                    }()
                }]
            }];
            m.Menu.setApplicationMenu(m.Menu.buildFromTemplate(d))
        }

        function a(e) {
            var t = e.x,
                n = e.y;
            if (!m.screen.getAllDisplays().find((function (e) {
                var r = e.bounds;
                if (r) {
                    var o = r.x,
                        i = r.y,
                        a = r.width,
                        c = r.height;
                    return v.inRange(t, o, o + a) && v.inRange(n, i, i + c)
                }
            }))) {
                var r = m.screen.getDisplayNearestPoint({
                    x: t,
                    y: n
                }).bounds;
                if (r) return {
                    x: r.x,
                    y: r.y
                }
            }
            return {
                x: t,
                y: n
            }
        }

        function c() {
            try {
                w.writeFileSync(C, JSON.stringify({
                    bounds: _.getBounds(),
                    subBounds: O ? O.getBounds() : {}
                }))
            } catch (e) {}
        }

        function s() {
            try {
                return JSON.parse(w.readFileSync(C, "utf8"))
            } catch (e) {}
            return {}
        }
        n.r(t);
        var u = n(1),
            l = n.n(u),
            d = n(2),
            f = n.n(d),
            p = n(4),
            h = n.n(p),
            m = n(0),
            g = (n.n(m), n(0).TouchBar),
            b = g.TouchBarButton,
            y = n(3),
            w = n(7),
            v = n(8),
            E = n(9);
        n(10).initialize(), global.__static = n(3).join(__dirname, "/static").replace(/\\/g, "\\\\"), E(), m.app.disableHardwareAcceleration(), m.app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors"), "darwin" === process.platform && m.app.dock.hide();
        var _, O, R, x, C = y.join(m.app.getPath("userData"), "window_ocnfig.json"),
            k = "file://".concat(__dirname, "/index.html"),
            M = m.app.requestSingleInstanceLock();
        m.app.setAppUserModelId("com.lbyczf.clashwin"), m.app.setAsDefaultProtocolClient("clash"), m.app.setName("Clash for Windows"), m.app.setAboutPanelOptions({
            version: ""
        }), m.app.on("open-url", (function (e, t) {
            _.webContents.send("app-open", [t])
        })), M ? (m.app.on("second-instance", (function (e, t) {
            _ && (_.webContents.send("app-open", t), _.isMinimized() && _.restore(), _.show())
        })), m.app.on("ready", (function () {
            m.powerMonitor.on("shutdown", (function (e) {
                e.preventDefault(), _.webContents.send("app-exit"), setTimeout((function () {
                    m.app.isQuiting = !0, m.app.quit()
                }), 5e3)
            })), i()
        }))) : m.app.quit(), m.app.on("activate", (function () {
            null === _ ? i() : _.show()
        }))
    },
    function (e) {
        var t = function (e) {
            "use strict";

            function t(e, t, n) {
                return Object.defineProperty(e, t, {
                    value: n,
                    enumerable: !0,
                    configurable: !0,
                    writable: !0
                }), e[t]
            }

            function n(e, t, n, r) {
                var i = t && t.prototype instanceof o ? t : o,
                    a = Object.create(i.prototype),
                    c = new p(r || []);
                return a._invoke = u(e, n, c), a
            }

            function r(e, t, n) {
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

            function o() {}

            function i() {}

            function a() {}

            function c(e) {
                ["next", "throw", "return"].forEach((function (n) {
                    t(e, n, (function (e) {
                        return this._invoke(n, e)
                    }))
                }))
            }

            function s(e, t) {
                function n(o, i, a, c) {
                    var s = r(e[o], e, i);
                    if ("throw" !== s.type) {
                        var u = s.arg,
                            l = u.value;
                        return l && "object" == typeof l && b.call(l, "__await") ? t.resolve(l.__await).then((function (e) {
                            n("next", e, a, c)
                        }), (function (e) {
                            n("throw", e, a, c)
                        })) : t.resolve(l).then((function (e) {
                            u.value = e, a(u)
                        }), (function (e) {
                            return n("throw", e, a, c)
                        }))
                    }
                    c(s.arg)
                }
                var o;
                this._invoke = function (e, r) {
                    function i() {
                        return new t((function (t, o) {
                            n(e, r, t, o)
                        }))
                    }
                    return o = o ? o.then(i, i) : i()
                }
            }

            function u(e, t, n) {
                var o = _;
                return function (i, a) {
                    if (o == R) throw new Error("Generator is already running");
                    if (o == x) {
                        if ("throw" === i) throw a;
                        return {
                            value: void 0,
                            done: !0
                        }
                    }
                    for (n.method = i, n.arg = a;;) {
                        var c = n.delegate;
                        if (c) {
                            var s = l(c, n);
                            if (s) {
                                if (s === C) continue;
                                return s
                            }
                        }
                        if ("next" === n.method) n.sent = n._sent = n.arg;
                        else if ("throw" === n.method) {
                            if (o == _) throw o = x, n.arg;
                            n.dispatchException(n.arg)
                        } else "return" === n.method && n.abrupt("return", n.arg);
                        o = R;
                        var u = r(e, t, n);
                        if ("normal" === u.type) {
                            if (o = n.done ? x : O, u.arg === C) continue;
                            return {
                                value: u.arg,
                                done: n.done
                            }
                        }
                        "throw" === u.type && (o = x, n.method = "throw", n.arg = u.arg)
                    }
                }
            }

            function l(e, t) {
                var n = e.iterator[t.method];
                if (void 0 === n) {
                    if (t.delegate = null, "throw" === t.method) {
                        if (e.iterator.return && (t.method = "return", t.arg = void 0, l(e, t), "throw" === t.method)) return C;
                        t.method = "throw", t.arg = new TypeError("The iterator does not provide a 'throw' method")
                    }
                    return C
                }
                var o = r(n, e.iterator, t.arg);
                if ("throw" === o.type) return t.method = "throw", t.arg = o.arg, t.delegate = null, C;
                var i = o.arg;
                return i ? i.done ? (t[e.resultName] = i.value, t.next = e.nextLoc, "return" !== t.method && (t.method = "next", t.arg = void 0), t.delegate = null, C) : i : (t.method = "throw", t.arg = new TypeError("iterator result is not an object"), t.delegate = null, C)
            }

            function d(e) {
                var t = {
                    tryLoc: e[0]
                };
                1 in e && (t.catchLoc = e[1]), 2 in e && (t.finallyLoc = e[2], t.afterLoc = e[3]), this.tryEntries.push(t)
            }

            function f(e) {
                var t = e.completion || {};
                t.type = "normal", delete t.arg, e.completion = t
            }

            function p(e) {
                this.tryEntries = [{
                    tryLoc: "root"
                }], e.forEach(d, this), this.reset(!0)
            }

            function h(e) {
                if (e) {
                    var t = e[w];
                    if (t) return t.call(e);
                    if ("function" == typeof e.next) return e;
                    if (!isNaN(e.length)) {
                        var n = -1,
                            r = function t() {
                                for (; ++n < e.length;)
                                    if (b.call(e, n)) return t.value = e[n], t.done = !1, t;
                                return t.value = void 0, t.done = !0, t
                            };
                        return r.next = r
                    }
                }
                return {
                    next: m
                }
            }

            function m() {
                return {
                    value: void 0,
                    done: !0
                }
            }
            var g = Object.prototype,
                b = g.hasOwnProperty,
                y = "function" == typeof Symbol ? Symbol : {},
                w = y.iterator || "@@iterator",
                v = y.asyncIterator || "@@asyncIterator",
                E = y.toStringTag || "@@toStringTag";
            try {
                t({}, "")
            } catch (e) {
                t = function (e, t, n) {
                    return e[t] = n
                }
            }
            e.wrap = n;
            var _ = "suspendedStart",
                O = "suspendedYield",
                R = "executing",
                x = "completed",
                C = {},
                k = {};
            k[w] = function () {
                return this
            };
            var M = Object.getPrototypeOf,
                j = M && M(M(h([])));
            j && j !== g && b.call(j, w) && (k = j);
            var B = a.prototype = o.prototype = Object.create(k);
            return i.prototype = B.constructor = a, a.constructor = i, i.displayName = t(a, E, "GeneratorFunction"), e.isGeneratorFunction = function (e) {
                var t = "function" == typeof e && e.constructor;
                return !!t && (t === i || "GeneratorFunction" === (t.displayName || t.name))
            }, e.mark = function (e) {
                return Object.setPrototypeOf ? Object.setPrototypeOf(e, a) : (e.__proto__ = a, t(e, E, "GeneratorFunction")), e.prototype = Object.create(B), e
            }, e.awrap = function (e) {
                return {
                    __await: e
                }
            }, c(s.prototype), s.prototype[v] = function () {
                return this
            }, e.AsyncIterator = s, e.async = function (t, r, o, i, a) {
                void 0 === a && (a = Promise);
                var c = new s(n(t, r, o, i), a);
                return e.isGeneratorFunction(r) ? c : c.next().then((function (e) {
                    return e.done ? e.value : c.next()
                }))
            }, c(B), t(B, E, "Generator"), B[w] = function () {
                return this
            }, B.toString = function () {
                return "[object Generator]"
            }, e.keys = function (e) {
                var t = [];
                for (var n in e) t.push(n);
                return t.reverse(),
                    function n() {
                        for (; t.length;) {
                            var r = t.pop();
                            if (r in e) return n.value = r, n.done = !1, n
                        }
                        return n.done = !0, n
                    }
            }, e.values = h, p.prototype = {
                constructor: p,
                reset: function (e) {
                        if (this.prev = 0, this.next = 0, this.sent = this._sent = void 0, this.done = !1, this.delegate = null, this.method = "next", this.arg = void 0, this.tryEntries.forEach(f), !e)
                            for (var t in this) "t" === t.charAt(0) && b.call(this, t) && !isNaN(+t.slice(1)) && (this[t] = void 0)
                    }, stop: function () {
                        this.done = !0;
                        var e = this.tryEntries[0].completion;
                        if ("throw" === e.type) throw e.arg;
                        return this.rval
                    }, dispatchException: function (e) {
                        function t(t, r) {
                            return i.type = "throw", i.arg = e, n.next = t, r && (n.method = "next", n.arg = void 0), !!r
                        }
                        if (this.done) throw e;
                        for (var n = this, r = this.tryEntries.length - 1; 0 <= r; --r) {
                            var o = this.tryEntries[r],
                                i = o.completion;
                            if ("root" === o.tryLoc) return t("end");
                            if (o.tryLoc <= this.prev) {
                                var a = b.call(o, "catchLoc"),
                                    c = b.call(o, "finallyLoc");
                                if (a && c) {
                                    if (this.prev < o.catchLoc) return t(o.catchLoc, !0);
                                    if (this.prev < o.finallyLoc) return t(o.finallyLoc)
                                } else if (a) {
                                    if (this.prev < o.catchLoc) return t(o.catchLoc, !0)
                                } else {
                                    if (!c) throw new Error("try statement without catch or finally");
                                    if (this.prev < o.finallyLoc) return t(o.finallyLoc)
                                }
                            }
                        }
                    }, abrupt: function (e, t) {
                        for (var n, r = this.tryEntries.length - 1; 0 <= r; --r)
                            if ((n = this.tryEntries[r]).tryLoc <= this.prev && b.call(n, "finallyLoc") && this.prev < n.finallyLoc) {
                                var o = n;
                                break
                            }
                        o && ("break" === e || "continue" === e) && o.tryLoc <= t && t <= o.finallyLoc && (o = null);
                        var i = o ? o.completion : {};
                        return i.type = e, i.arg = t, o ? (this.method = "next", this.next = o.finallyLoc, C) : this.complete(i)
                    }, complete: function (e, t) {
                        if ("throw" === e.type) throw e.arg;
                        return "break" === e.type || "continue" === e.type ? this.next = e.arg : "return" === e.type ? (this.rval = this.arg = e.arg, this.method = "return", this.next = "end") : "normal" === e.type && t && (this.next = t), C
                    }, finish: function (e) {
                        for (var t, n = this.tryEntries.length - 1; 0 <= n; --n)
                            if ((t = this.tryEntries[n]).finallyLoc === e) return this.complete(t.completion, t.afterLoc), f(t), C
                    },
                    catch: function (e) {
                        for (var t, n = this.tryEntries.length - 1; 0 <= n; --n)
                            if ((t = this.tryEntries[n]).tryLoc === e) {
                                var r = t.completion;
                                if ("throw" === r.type) {
                                    var o = r.arg;
                                    f(t)
                                }
                                return o
                            }
                        throw new Error("illegal catch attempt")
                    }, delegateYield: function (e, t, n) {
                        return this.delegate = {
                            iterator: h(e),
                            resultName: t,
                            nextLoc: n
                        }, "next" === this.method && (this.arg = void 0), C
                    }
            }, e
        }(e.exports);
        try {
            regeneratorRuntime = t
        } catch (e) {
            Function("r", "regeneratorRuntime = r")(t)
        }
    },
    function (e) {
        e.exports = require("fs")
    },
    function (e) {
        e.exports = require("lodash")
    },
    function (e) {
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

        function r(e) {
            const t = e[0] + "~" + e[1],
                n = d.get(t);
            if (void 0 !== n) {
                const e = n.deref();
                if (void 0 !== e) return e
            }
        }
        var o = this && this.__importDefault || function (e) {
            return e && e.__esModule ? e : {
                default: e
            }
        };
        Object.defineProperty(t, "__esModule", {
            value: !0
        }), t.initialize = t.isRemoteModuleEnabled = void 0;
        const i = n(13),
            a = o(n(14)),
            c = n(15),
            s = n(0),
            u = n(16).getElectronBinding("v8_util"),
            l = ["length", "name", "arguments", "caller", "prototype"],
            d = new Map,
            f = new FinalizationRegistry(e => {
                const t = e.id[0] + "~" + e.id[1],
                    n = d.get(t);
                if (void 0 !== n && void 0 === n.deref() && (d.delete(t), !e.webContents.isDestroyed())) try {
                    e.webContents.sendToFrame(e.frameId, "REMOTE_RENDERER_RELEASE_CALLBACK", e.id[0], e.id[1])
                } catch (e) {
                    console.warn(`sendToFrame() failed: ${e}`)
                }
            }),
            p = new WeakMap,
            h = function (e) {
                let t = Object.getOwnPropertyNames(e);
                return "function" == typeof e && (t = t.filter(e => !l.includes(e))), t.map(t => {
                    const n = Object.getOwnPropertyDescriptor(e, t);
                    let r, o = !1;
                    return void 0 === n.get && "function" == typeof e[t] ? r = "method" : ((n.set || n.writable) && (o = !0), r = "get"), {
                        name: t,
                        enumerable: n.enumerable,
                        writable: o,
                        type: r
                    }
                })
            },
            m = function (e) {
                const t = Object.getPrototypeOf(e);
                return null === t || t === Object.prototype ? null : {
                    members: h(t),
                    proto: m(t)
                }
            },
            g = function (e, t, n, r = !1) {
                let o;
                switch (typeof n) {
                case "object":
                    o = n instanceof Buffer ? "buffer" : n && n.constructor && "NativeImage" === n.constructor.name ? "nativeimage" : Array.isArray(n) ? "array" : n instanceof Error ? "error" : c.isSerializableObject(n) ? "value" : c.isPromise(n) ? "promise" : Object.prototype.hasOwnProperty.call(n, "callee") && null != n.length ? "array" : r && u.getHiddenValue(n, "simple") ? "value" : "object";
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
                    value: c.serialize(n)
                } : "object" === o || "function" === o ? {
                    type: o,
                    name: n.constructor ? n.constructor.name : "",
                    id: a.default.add(e, t, n),
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
                let n = "Attempting to call a function in a renderer window that has been closed or released." + `\nFunction provided here: ${p.get(t)}`;
                if (e instanceof i.EventEmitter) {
                    const r = e.eventNames().filter(n => e.listeners(n).includes(t));
                    0 < r.length && (n += `\nRemote event names: ${r.join(", ")}`, r.forEach(n => {
                        e.removeListener(n, t)
                    }))
                }
                console.warn(n)
            },
            w = (e, t) => new Proxy(Object, {
                get: (e, n, r) => "name" === n ? t : Reflect.get(e, n, r)
            }),
            v = function (e, t, n, o) {
                const i = function (o) {
                    switch (o.type) {
                    case "nativeimage":
                        return c.deserialize(o.value);
                    case "value":
                        return o.value;
                    case "remote-object":
                        return a.default.get(o.id);
                    case "array":
                        return v(e, t, n, o.value);
                    case "buffer":
                        return Buffer.from(o.value.buffer, o.value.byteOffset, o.value.byteLength);
                    case "promise":
                        return Promise.resolve({
                            then: i(o.then)
                        });
                    case "object":
                        {
                            const e = "Object" === o.name ? {} : Object.create({
                                constructor: w(0, o.name)
                            });
                            for (const {
                                    name: t,
                                    value: n
                                }
                                of o.members) e[t] = i(n);
                            return e
                        }
                    case "function-with-return-value":
                        {
                            const e = i(o.value);
                            return function () {
                                return e
                            }
                        }
                    case "function":
                        {
                            const i = [n, o.id],
                                a = r(i);
                            if (void 0 !== a) return a;
                            const c = function (...r) {
                                let i = !1;
                                if (!e.isDestroyed()) try {
                                    i = !1 !== e.sendToFrame(t, "REMOTE_RENDERER_CALLBACK", n, o.id, g(e, n, r))
                                } catch (e) {
                                    console.warn(`sendToFrame() failed: ${e}`)
                                }
                                i || y(this, c)
                            };
                            return p.set(c, o.location), Object.defineProperty(c, "length", {
                                    value: o.length
                                }),
                                function (e, t, n, r) {
                                    const o = new WeakRef(r),
                                        i = e[0] + "~" + e[1];
                                    d.set(i, o), f.register(r, {
                                        id: e,
                                        webContents: t,
                                        frameId: n
                                    })
                                }(i, e, t, c), c
                        }
                    default:
                        throw new TypeError(`Unknown type: ${o.type}`)
                    }
                };
                return o.map(i)
            },
            E = new WeakMap;
        t.isRemoteModuleEnabled = function (e) {
            return E.has(e) || E.set(e, function (e) {
                const t = e.getLastWebPreferences() || {};
                return null != t.enableRemoteModule && !!t.enableRemoteModule
            }(e)), E.get(e)
        };
        const _ = function (e, n) {
                s.ipcMain.on(e, (e, r, ...o) => {
                    let i;
                    if (t.isRemoteModuleEnabled(e.sender)) {
                        try {
                            i = n(e, r, ...o)
                        } catch (t) {
                            i = {
                                type: "exception",
                                value: g(e.sender, r, t)
                            }
                        }
                        void 0 !== i && (e.returnValue = i)
                    } else e.returnValue = {
                        type: "exception",
                        value: g(e.sender, r, new Error("@electron/remote is disabled for this WebContents. Set {enableRemoteModule: true} in WebPreferences to enable it."))
                    }
                })
            },
            O = function (e, t, ...n) {
                const r = {
                    sender: e,
                    returnValue: void 0,
                    defaultPrevented: !1
                };
                return s.app.emit(t, r, e, ...n), e.emit(t, r, ...n), r
            },
            R = function (e, t, n) {
                n && console.warn(`WebContents (${e.id}): ${t}`, n)
            };
        let x = !1;
        t.initialize = function () {
            if (x) throw new Error("electron-remote has already been initialized");
            x = !0, _("REMOTE_BROWSER_WRONG_CONTEXT_ERROR", (function (e, t, n, o) {
                const i = r([n, o]);
                void 0 === i || y(e.sender, i)
            })), _("REMOTE_BROWSER_REQUIRE", (function (e, t, n, r) {
                R(e.sender, `remote.require('${n}')`, r);
                const o = O(e.sender, "remote-require", n);
                if (void 0 === o.returnValue) {
                    if (o.defaultPrevented) throw new Error(`Blocked remote.require('${n}')`);
                    o.returnValue = process.mainModule.require(n)
                }
                return g(e.sender, t, o.returnValue)
            })), _("REMOTE_BROWSER_GET_BUILTIN", (function (e, t, r, o) {
                R(e.sender, `remote.getBuiltin('${r}')`, o);
                const i = O(e.sender, "remote-get-builtin", r);
                if (void 0 === i.returnValue) {
                    if (i.defaultPrevented) throw new Error(`Blocked remote.getBuiltin('${r}')`);
                    i.returnValue = n(0)[r]
                }
                return g(e.sender, t, i.returnValue)
            })), _("REMOTE_BROWSER_GET_GLOBAL", (function (e, t, n, r) {
                R(e.sender, `remote.getGlobal('${n}')`, r);
                const o = O(e.sender, "remote-get-global", n);
                if (void 0 === o.returnValue) {
                    if (o.defaultPrevented) throw new Error(`Blocked remote.getGlobal('${n}')`);
                    o.returnValue = global[n]
                }
                return g(e.sender, t, o.returnValue)
            })), _("REMOTE_BROWSER_GET_CURRENT_WINDOW", (function (e, t, n) {
                R(e.sender, "remote.getCurrentWindow()", n);
                const r = O(e.sender, "remote-get-current-window");
                if (void 0 === r.returnValue) {
                    if (r.defaultPrevented) throw new Error("Blocked remote.getCurrentWindow()");
                    r.returnValue = e.sender.getOwnerBrowserWindow()
                }
                return g(e.sender, t, r.returnValue)
            })), _("REMOTE_BROWSER_GET_CURRENT_WEB_CONTENTS", (function (e, t, n) {
                R(e.sender, "remote.getCurrentWebContents()", n);
                const r = O(e.sender, "remote-get-current-web-contents");
                if (void 0 === r.returnValue) {
                    if (r.defaultPrevented) throw new Error("Blocked remote.getCurrentWebContents()");
                    r.returnValue = e.sender
                }
                return g(e.sender, t, r.returnValue)
            })), _("REMOTE_BROWSER_CONSTRUCTOR", (function (e, t, n, r) {
                r = v(e.sender, e.frameId, t, r);
                const o = a.default.get(n);
                return null == o && b(`Cannot call constructor on missing remote object ${n}`), g(e.sender, t, new o(...r))
            })), _("REMOTE_BROWSER_FUNCTION_CALL", (function (e, t, n, r) {
                r = v(e.sender, e.frameId, t, r);
                const o = a.default.get(n);
                null == o && b(`Cannot call function on missing remote object ${n}`);
                try {
                    return g(e.sender, t, o(...r), !0)
                } catch (e) {
                    const t = new Error(`Could not call remote function '${o.name||"anonymous"}'. Check that the function signature is correct. Underlying error: ${e.message}\nUnderlying stack: ${e.stack}\n`);
                    throw t.cause = e, t
                }
            })), _("REMOTE_BROWSER_MEMBER_CONSTRUCTOR", (function (e, t, n, r, o) {
                o = v(e.sender, e.frameId, t, o);
                const i = a.default.get(n);
                return null == i && b(`Cannot call constructor '${r}' on missing remote object ${n}`), g(e.sender, t, new i[r](...o))
            })), _("REMOTE_BROWSER_MEMBER_CALL", (function (e, t, n, r, o) {
                o = v(e.sender, e.frameId, t, o);
                const i = a.default.get(n);
                null == i && b(`Cannot call method '${r}' on missing remote object ${n}`);
                try {
                    return g(e.sender, t, i[r](...o), !0)
                } catch (e) {
                    const t = new Error(`Could not call remote method '${r}'. Check that the method signature is correct. Underlying error: ${e.message}\nUnderlying stack: ${e.stack}\n`);
                    throw t.cause = e, t
                }
            })), _("REMOTE_BROWSER_MEMBER_SET", (function (e, t, n, r, o) {
                o = v(e.sender, e.frameId, t, o);
                const i = a.default.get(n);
                return null == i && b(`Cannot set property '${r}' on missing remote object ${n}`), i[r] = o[0], null
            })), _("REMOTE_BROWSER_MEMBER_GET", (function (e, t, n, r) {
                const o = a.default.get(n);
                return null == o && b(`Cannot get property '${r}' on missing remote object ${n}`), g(e.sender, t, o[r])
            })), _("REMOTE_BROWSER_DEREFERENCE", (function (e, t, n) {
                a.default.remove(e.sender, t, n)
            })), _("REMOTE_BROWSER_CONTEXT_RELEASE", (e, t) => (a.default.clear(e.sender, t), null))
        }
    },
    function (e) {
        e.exports = require("events")
    },
    function (e, t) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        });
        const n = (e, t) => `${e.id}-${t}`;
        t.default = new class {
            constructor() {
                this.nextId = 0, this.storage = {}, this.owners = {}, this.electronIds = new WeakMap
            }
            add(e, t, r) {
                const o = this.saveToStorage(r),
                    i = n(e, t);
                let a = this.owners[i];
                return a || (a = this.owners[i] = new Map, this.registerDeleteListener(e, t)), a.has(o) || (a.set(o, 0), this.storage[o].count++), a.set(o, a.get(o) + 1), o
            }
            get(e) {
                const t = this.storage[e];
                if (null != t) return t.object
            }
            remove(e, t, r) {
                const o = n(e, t),
                    i = this.owners[o];
                if (i && i.has(r)) {
                    const e = i.get(r) - 1;
                    0 >= e ? (i.delete(r), this.dereference(r)) : i.set(r, e)
                }
            }
            clear(e, t) {
                const r = n(e, t),
                    o = this.owners[r];
                if (o) {
                    for (const e of o.keys()) this.dereference(e);
                    delete this.owners[r]
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
                null == t || (t.count -= 1, 0 === t.count && (this.electronIds.delete(t.object), delete this.storage[e]))
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

        function r(e) {
            return null === e || ArrayBuffer.isView(e) || i.some(t => e instanceof t)
        }
        Object.defineProperty(t, "__esModule", {
            value: !0
        }), t.deserialize = t.serialize = t.isSerializableObject = t.isPromise = void 0;
        const o = n(0);
        t.isPromise = function (e) {
            return e && e.then && e.then instanceof Function && e.constructor && e.constructor.reject && e.constructor.reject instanceof Function && e.constructor.resolve && e.constructor.resolve instanceof Function
        };
        const i = [Boolean, Number, String, Date, Error, RegExp, ArrayBuffer];
        t.isSerializableObject = r;
        const a = function (e, t) {
            const n = Object.entries(e).map(([e, n]) => [e, t(n)]);
            return Object.fromEntries(n)
        };
        t.serialize = function e(t) {
            return t && t.constructor && "NativeImage" === t.constructor.name ? function (e) {
                const t = [],
                    n = e.getScaleFactors();
                if (1 === n.length) {
                    const r = n[0],
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
                        const n = e.getSize(r),
                            o = e.toDataURL({
                                scaleFactor: r
                            });
                        t.push({
                            scaleFactor: r,
                            size: n,
                            dataURL: o
                        })
                    }
                return {
                    __ELECTRON_SERIALIZED_NativeImage__: !0,
                    representations: t
                }
            }(t) : Array.isArray(t) ? t.map(e) : r(t) ? t : t instanceof Object ? a(t, e) : t
        }, t.deserialize = function e(t) {
            return t && t.__ELECTRON_SERIALIZED_NativeImage__ ? function (e) {
                const t = o.nativeImage.createEmpty();
                if (1 === e.representations.length) {
                    const {
                        buffer: n,
                        size: r,
                        scaleFactor: o
                    } = e.representations[0], {
                        width: i,
                        height: a
                    } = r;
                    t.addRepresentation({
                        buffer: n,
                        scaleFactor: o,
                        width: i,
                        height: a
                    })
                } else
                    for (const n of e.representations) {
                        const {
                            dataURL: e,
                            size: r,
                            scaleFactor: o
                        } = n, {
                            width: i,
                            height: a
                        } = r;
                        t.addRepresentation({
                            dataURL: e,
                            scaleFactor: o,
                            width: i,
                            height: a
                        })
                    }
                return t
            }(t) : Array.isArray(t) ? t.map(e) : r(t) ? t : t instanceof Object ? a(t, e) : t
        }
    },
    function (e, t) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        }), t.getElectronBinding = void 0, t.getElectronBinding = process.electronBinding ? e => process.electronBinding(e) : e => process._linkedBinding("electron_common_" + e)
    }
]);
