(() => {
    var e = {
            228: e => {
                e.exports = function(ar, len) {
                    if (null == len || len > ar.length) {
                        len = ar.length;
                    }
                    /** @type {number} */
                    var i = 0;
                    /** @type {Array} */
                    var a = new Array(len);
                    for (; i < len; i++) {
                        a[i] = ar[i];
                    }
                    return a;
                }, e.exports.default = e.exports, e.exports.__esModule = true;
            },
            858: e => {
                e.exports = function(argv) {
                    if (Array.isArray(argv)) {
                        return argv;
                    }
                }, e.exports.default = e.exports, e.exports.__esModule = true;

            },
            646: (e, t, n) => {
                var r = n(228);
                e.exports = function(args) {
                    if (Array.isArray(args)) {
                        return r(args);
                    }
                }, e.exports.default = e.exports, e.exports.__esModule = true;
            },
            926: e => {
                function t(args, next, b, c, reject, type, message) {
                    try {
                        var input = args[type](message);
                        var val = input.value;
                    } catch (self) {
                        return void b(self);
                    }
                    if (input.done) {
                        next(val);
                    } else {
                        Promise.resolve(val).then(c, reject);
                    }
                }
                e.exports = function(e) {
                    return function() {
                        var n = this,
                            r = arguments;
                        return new Promise((function(o, i) {
                            var a = e.apply(n, r);

                            function c(e) {
                                t(a, o, i, c, s, "next", e)
                            }

                            function s(e) {
                                t(a, o, i, c, s, "throw", e)
                            }
                            c(void 0)
                        }))
                    }
                }, e.exports.default = e.exports, e.exports.__esModule = !0
            },
            713: e => {
                e.exports = function(e, t, n) {
                    return t in e ? Object.defineProperty(e, t, {
                        value: n,
                        enumerable: !0,
                        configurable: !0,
                        writable: !0
                    }) : e[t] = n, e
                }, e.exports.default = e.exports, e.exports.__esModule = !0
            },
            860: e => {
                e.exports = function(e) {
                    if ("undefined" != typeof Symbol && null != e[Symbol.iterator] || null != e["@@iterator"]) return Array.from(e)
                }, e.exports.default = e.exports, e.exports.__esModule = !0
            },
            884: e => {
                e.exports = function(e, t) {
                    var n = e && ("undefined" != typeof Symbol && e[Symbol.iterator] || e["@@iterator"]);
                    if (null != n) {
                        var r, o, i = [],
                            a = !0,
                            c = !1;
                        try {
                            for (n = n.call(e); !(a = (r = n.next()).done) && (i.push(r.value), !t || i.length !== t); a = !0);
                        } catch (e) {
                            c = !0, o = e
                        } finally {
                            try {
                                a || null == n.return || n.return()
                            } finally {
                                if (c) throw o
                            }
                        }
                        return i
                    }
                }, e.exports.default = e.exports, e.exports.__esModule = !0
            },
            521: e => {
                e.exports = function() {
                    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                }, e.exports.default = e.exports, e.exports.__esModule = !0
            },
            206: e => {
                e.exports = function() {
                    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                }, e.exports.default = e.exports, e.exports.__esModule = !0
            },
            38: (e, t, n) => {
                var r = n(858),
                    o = n(884),
                    i = n(379),
                    a = n(521);
                e.exports = function(e, t) {
                    return r(e) || o(e, t) || i(e, t) || a()
                }, e.exports.default = e.exports, e.exports.__esModule = !0
            },
            319: (e, t, n) => {
                var r = n(646),
                    o = n(860),
                    i = n(379),
                    a = n(206);
                e.exports = function(e) {
                    return r(e) || o(e) || i(e) || a()
                }, e.exports.default = e.exports, e.exports.__esModule = !0
            },
            379: (e, t, n) => {
                var r = n(228);
                e.exports = function(e, t) {
                    if (e) {
                        if ("string" == typeof e) return r(e, t);
                        var n = Object.prototype.toString.call(e).slice(8, -1);
                        return "Object" === n && e.constructor && (n = e.constructor.name), "Map" === n || "Set" === n ? Array.from(e) : "Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? r(e, t) : void 0
                    }
                }, e.exports.default = e.exports, e.exports.__esModule = !0
            },
            757: (e, t, n) => {
                e.exports = n(666)
            },
            666: e => {
                var t = function(e) {
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
                    } catch (e) {
                        s = function(e, t, n) {
                            return e[t] = n
                        }
                    }

                    function l(e, t, n, r) {
                        var o = t && t.prototype instanceof b ? t : b,
                            i = Object.create(o.prototype),
                            a = new P(r || []);
                        return i._invoke = function(e, t, n) {
                            var r = p;
                            return function(o, i) {
                                if (r === f) throw new Error("Generator is already running");
                                if (r === h) {
                                    if ("throw" === o) throw i;
                                    return T()
                                }
                                for (n.method = o, n.arg = i;;) {
                                    var a = n.delegate;
                                    if (a) {
                                        var c = _(a, n);
                                        if (c) {
                                            if (c === m) continue;
                                            return c
                                        }
                                    }
                                    if ("next" === n.method) n.sent = n._sent = n.arg;
                                    else if ("throw" === n.method) {
                                        if (r === p) throw r = h, n.arg;
                                        n.dispatchException(n.arg)
                                    } else "return" === n.method && n.abrupt("return", n.arg);
                                    r = f;
                                    var s = u(e, t, n);
                                    if ("normal" === s.type) {
                                        if (r = n.done ? h : d, s.arg === m) continue;
                                        return {
                                            value: s.arg,
                                            done: n.done
                                        }
                                    }
                                    "throw" === s.type && (r = h, n.method = "throw", n.arg = s.arg)
                                }
                            }
                        }(e, n, a), i
                    }

                    function u(e, t, n) {
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
                    e.wrap = l;
                    var p = "suspendedStart",
                        d = "suspendedYield",
                        f = "executing",
                        h = "completed",
                        m = {};

                    function b() {}

                    function g() {}

                    function y() {}
                    var w = {};
                    w[i] = function() {
                        return this
                    };
                    var v = Object.getPrototypeOf,
                        x = v && v(v(I([])));
                    x && x !== n && r.call(x, i) && (w = x);
                    var k = y.prototype = b.prototype = Object.create(w);

                    function C(e) {
                        ["next", "throw", "return"].forEach((function(t) {
                            s(e, t, (function(e) {
                                return this._invoke(t, e)
                            }))
                        }))
                    }

                    function M(e, t) {
                        function n(o, i, a, c) {
                            var s = u(e[o], e, i);
                            if ("throw" !== s.type) {
                                var l = s.arg,
                                    p = l.value;
                                return p && "object" == typeof p && r.call(p, "__await") ? t.resolve(p.__await).then((function(e) {
                                    n("next", e, a, c)
                                }), (function(e) {
                                    n("throw", e, a, c)
                                })) : t.resolve(p).then((function(e) {
                                    l.value = e, a(l)
                                }), (function(e) {
                                    return n("throw", e, a, c)
                                }))
                            }
                            c(s.arg)
                        }
                        var o;
                        this._invoke = function(e, r) {
                            function i() {
                                return new t((function(t, o) {
                                    n(e, r, t, o)
                                }))
                            }
                            return o = o ? o.then(i, i) : i()
                        }
                    }

                    function _(e, n) {
                        var r = e.iterator[n.method];
                        if (r === t) {
                            if (n.delegate = null, "throw" === n.method) {
                                if (e.iterator.return && (n.method = "return", n.arg = t, _(e, n), "throw" === n.method)) return m;
                                n.method = "throw", n.arg = new TypeError("The iterator does not provide a 'throw' method")
                            }
                            return m
                        }
                        var o = u(r, e.iterator, n.arg);
                        if ("throw" === o.type) return n.method = "throw", n.arg = o.arg, n.delegate = null, m;
                        var i = o.arg;
                        return i ? i.done ? (n[e.resultName] = i.value, n.next = e.nextLoc, "return" !== n.method && (n.method = "next", n.arg = t), n.delegate = null, m) : i : (n.method = "throw", n.arg = new TypeError("iterator result is not an object"), n.delegate = null, m)
                    }

                    function S(e) {
                        var t = {
                            tryLoc: e[0]
                        };
                        1 in e && (t.catchLoc = e[1]), 2 in e && (t.finallyLoc = e[2], t.afterLoc = e[3]), this.tryEntries.push(t)
                    }

                    function O(e) {
                        var t = e.completion || {};
                        t.type = "normal", delete t.arg, e.completion = t
                    }

                    function P(e) {
                        this.tryEntries = [{
                            tryLoc: "root"
                        }], e.forEach(S, this), this.reset(!0)
                    }

                    function I(e) {
                        if (e) {
                            var n = e[i];
                            if (n) return n.call(e);
                            if ("function" == typeof e.next) return e;
                            if (!isNaN(e.length)) {
                                var o = -1,
                                    a = function n() {
                                        for (; ++o < e.length;)
                                            if (r.call(e, o)) return n.value = e[o], n.done = !1, n;
                                        return n.value = t, n.done = !0, n
                                    };
                                return a.next = a
                            }
                        }
                        return {
                            next: T
                        }
                    }

                    function T() {
                        return {
                            value: t,
                            done: !0
                        }
                    }
                    return g.prototype = k.constructor = y, y.constructor = g, g.displayName = s(y, c, "GeneratorFunction"), e.isGeneratorFunction = function(e) {
                        var t = "function" == typeof e && e.constructor;
                        return !!t && (t === g || "GeneratorFunction" === (t.displayName || t.name))
                    }, e.mark = function(e) {
                        return Object.setPrototypeOf ? Object.setPrototypeOf(e, y) : (e.__proto__ = y, s(e, c, "GeneratorFunction")), e.prototype = Object.create(k), e
                    }, e.awrap = function(e) {
                        return {
                            __await: e
                        }
                    }, C(M.prototype), M.prototype[a] = function() {
                        return this
                    }, e.AsyncIterator = M, e.async = function(t, n, r, o, i) {
                        void 0 === i && (i = Promise);
                        var a = new M(l(t, n, r, o), i);
                        return e.isGeneratorFunction(n) ? a : a.next().then((function(e) {
                            return e.done ? e.value : a.next()
                        }))
                    }, C(k), s(k, c, "Generator"), k[i] = function() {
                        return this
                    }, k.toString = function() {
                        return "[object Generator]"
                    }, e.keys = function(e) {
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
                    }, e.values = I, P.prototype = {
                        constructor: P,
                        reset: function(e) {
                            if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(O), !e)
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
                            for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                                var a = this.tryEntries[i],
                                    c = a.completion;
                                if ("root" === a.tryLoc) return o("end");
                                if (a.tryLoc <= this.prev) {
                                    var s = r.call(a, "catchLoc"),
                                        l = r.call(a, "finallyLoc");
                                    if (s && l) {
                                        if (this.prev < a.catchLoc) return o(a.catchLoc, !0);
                                        if (this.prev < a.finallyLoc) return o(a.finallyLoc)
                                    } else if (s) {
                                        if (this.prev < a.catchLoc) return o(a.catchLoc, !0)
                                    } else {
                                        if (!l) throw new Error("try statement without catch or finally");
                                        if (this.prev < a.finallyLoc) return o(a.finallyLoc)
                                    }
                                }
                            }
                        },
                        abrupt: function(e, t) {
                            for (var n = this.tryEntries.length - 1; n >= 0; --n) {
                                var o = this.tryEntries[n];
                                if (o.tryLoc <= this.prev && r.call(o, "finallyLoc") && this.prev < o.finallyLoc) {
                                    var i = o;
                                    break
                                }
                            }
                            i && ("break" === e || "continue" === e) && i.tryLoc <= t && t <= i.finallyLoc && (i = null);
                            var a = i ? i.completion : {};
                            return a.type = e, a.arg = t, i ? (this.method = "next", this.next = i.finallyLoc, m) : this.complete(a)
                        },
                        complete: function(e, t) {
                            if ("throw" === e.type) throw e.arg;
                            return "break" === e.type || "continue" === e.type ? this.next = e.arg : "return" === e.type ? (this.rval = this.arg = e.arg, this.method = "return", this.next = "end") : "normal" === e.type && t && (this.next = t), m
                        },
                        finish: function(e) {
                            for (var t = this.tryEntries.length - 1; t >= 0; --t) {
                                var n = this.tryEntries[t];
                                if (n.finallyLoc === e) return this.complete(n.completion, n.afterLoc), O(n), m
                            }
                        },
                        catch: function(e) {
                            for (var t = this.tryEntries.length - 1; t >= 0; --t) {
                                var n = this.tryEntries[t];
                                if (n.tryLoc === e) {
                                    var r = n.completion;
                                    if ("throw" === r.type) {
                                        var o = r.arg;
                                        O(n)
                                    }
                                    return o
                                }
                            }
                            throw new Error("illegal catch attempt")
                        },
                        delegateYield: function(e, n, r) {
                            return this.delegate = {
                                iterator: I(e),
                                resultName: n,
                                nextLoc: r
                            }, "next" === this.method && (this.arg = t), m
                        }
                    }, e
                }(e.exports);
                try {
                    regeneratorRuntime = t
                } catch (e) {
                    Function("r", "regeneratorRuntime = r")(t)
                }
            },
            354: e => {
                "use strict";
                e.exports = require("@fndroid/network-interface")
            },
            113: e => {
                "use strict";
                e.exports = require("electron-window-bounds")
            },
            948: e => {
                "use strict";
                e.exports = require("fix-path")
            },
            793: e => {
                "use strict";
                e.exports = require("lodash")
            },
            298: e => {
                "use strict";
                e.exports = require("electron")
            },
            147: e => {
                "use strict";
                e.exports = require("fs")
            },
            17: e => {
                "use strict";
                e.exports = require("path")
            }
        },
        t = {};

    function n(r) {
        var o = t[r];
        if (void 0 !== o) return o.exports;
        var i = t[r] = {
            exports: {}
        };
        return e[r](i, i.exports, n), i.exports
    }
    n.names = e => {
        var t = e && e.__esModule ? () => e.default : () => e;
        return n.d(t, {
            a: t
        }), t
    }, n.d = (e, t) => {
        for (var r in t) n.o(t, r) && !n.o(e, r) && Object.defineProperty(e, r, {
            enumerable: !0,
            get: t[r]
        })
    }, n.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t), n.r = e => {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(e, "__esModule", {
            value: !0
        })
    };
    var r = {};
    (() => {
        "use strict";
        n.r(r);
        var e = n(319),
            t = n.names(e),
            o = n(38),
            i = n.names(o),
            a = n(713),
            c = n.names(a),
            s = n(926),
            l = n.names(s),
            u = n(757),
            p = n.names(u);
        require("@vue/reactivity");
        const d = require("axios");
        var f = n.names(d),
            host = n(298);

        function m(e, t) {
            var n = Object.keys(e);
            if (Object.getOwnPropertySymbols) {
                var r = Object.getOwnPropertySymbols(e);
                t && (r = r.filter((function(t) {
                    return Object.getOwnPropertyDescriptor(e, t).enumerable
                }))), n.push.apply(n, r)
            }
            return n
        }

        function b(e) {
            for (var t = 1; t < arguments.length; t++) {
                var n = null != arguments[t] ? arguments[t] : {};
                t % 2 ? m(Object(n), !0).forEach((function(t) {
                    c()(e, t, n[t])
                })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : m(Object(n)).forEach((function(t) {
                    Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t))
                }))
            }
            return e
        }
        var g, y, w, toolBar, x, k = n(298).TouchBar,
            C = k.TouchBarButton,
            M = n(17),
            _ = n(147),
            S = n(793),
            O = n(948);
        global.__static = n(17).join(__dirname, "/static").replace(/\\/g, "\\\\"), O(), host.app.disableHardwareAcceleration(), host.app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors"), "darwin" === process.platform && host.app.dock.hide();
        var P, I = [],
            T = "file://".concat(__dirname, "/index.html");

        function j() {
            return "linux" === process.platform
        }

        function Launch() {
            if (g) {
                if ("win32" === process.platform) {
                    if (g.isMinimized()) {
                        g.restore();
                    } else {
                        g.show();
                    }
                } else {
                    g.setVisibleOnAllWorkspaces(true);
                    setTimeout(function() {
                        g.show();
                        g.setVisibleOnAllWorkspaces(false);
                    }, 1);
                }
            }
        }

        function D() {
            var e, r;
            (g = new host.BrowserWindow({
                height: 603,
                width: 850,
                minWidth: 850,
                minHeight: 603,
                backgroundColor: host.nativeTheme.shouldUseDarkColors ? "#272531" : "#f5f5f5",
                useContentSize: true,
                show: false,
                minimizable: true,
                frame: false,
                titleBarStyle: "hidden",
                icon: j() ? M.join(__static, "imgs", "icon_512.png") : void 0,
                webPreferences: {
                    nodeIntegration: true,
                    webSecurity: true,
                    nodeIntegrationInWorker: false,
                    contextIsolation: false,
                    preload: M.resolve(M.join(__dirname, "preload.js"))
                }
            })).setMenu(null), g.webContents.on("will-navigate", function(types) {
                return types.preventDefault();
            }), g.loadURL(T, {
                userAgent: "ClashforWindows/".concat(host.app.getVersion())
            }), g.webContents.on("render-process-gone", (e = l()(p().mark(function e$$12(n, err) {
                var reason;
                var par;
                return p().wrap(function(self) {
                    for (;;) {
                        switch (self.prev = self.next) {
                            case 0:
                                if (reason = err.reason, "darwin" !== process.platform) {
                                    /** @type {number} */
                                    self.next = 3;
                                    break;
                                }
                                return self.abrupt("return");
                            case 3:
                                if ("crashed" !== reason) {
                                    /** @type {number} */
                                    self.next = 10;
                                    break;
                                }
                                return par = {
                                    type: "error",
                                    title: "Clash for Windows",
                                    message: "\u4eea\u8868\u677f\u5d29\u6e83\u4e86!",
                                    buttons: ["Reload", "Exit"]
                                }, self.next = 7, host.dialog.showMessageBox(g, par);
                            case 7:
                                if (0 === self.sent.response) {
                                    RelaunchApp();
                                } else {
                                    host.app.quit();
                                };
                            case 10:
                                ;
                            case "end":
                                return self.stop();
                        }
                    }
                }, e$$12);
            })), function(dataAndEvents, deepDataAndEvents) {
                return e.apply(this, arguments);
            })), host.ipcMain.handle("start-download", function(dataAndEvents, deepDataAndEvents, minX) {
                g.webContents.downloadURL(deepDataAndEvents);
                /** @type {Function} */
                x = minX;
            }), g.webContents.session.on("will-download", function(dataAndEvents, model, deepDataAndEvents) {
                if (x) {
                    model.setSavePath(x);
                    model.on("updated", function(deepDataAndEvents, dataAndEvents) {
                        if ("interrupted" === dataAndEvents) {
                            g.webContents.send("download", "interrupted");
                        } else {
                            if ("progressing" === dataAndEvents) {
                                if (model.isPaused()) {
                                    g.webContents.send("download", "paused");
                                } else {
                                    g.webContents.send("download", "downloading", model.getReceivedBytes() / model.getTotalBytes());
                                }
                            }
                        }
                    });
                    model.once("done", function(dataAndEvents, opt_content) {
                        if ("completed" === opt_content) {
                            g.webContents.send("download", "completed");
                        } else {
                            g.webContents.send("download", "failed", opt_content);
                        }
                    });
                    /** @type {null} */
                    x = null;
                }
            }), host.ipcMain.handle("app", function(deepDataAndEvents, dataAndEvents) {
                /** @type {number} */
                var len = arguments.length;
                /** @type {Array} */
                var newArgs = new Array(len > 2 ? len - 2 : 0);
                /** @type {number} */
                var i = 2;
                for (; i < len; i++) {
                    newArgs[i - 2] = arguments[i];
                }
                switch (dataAndEvents) {
                    case "isPackaged":
                        return host.app.isPackaged;
                    case "getPath":
                        return host.app.getPath.apply(host.app, newArgs);
                    case "getAppPath":
                        return host.app.getAppPath();
                    case "getName":
                        return host.app.getName();
                    case "getVersion":
                        return host.app.getVersion();
                    case "setLoginItemSettings":
                        return host.app.setLoginItemSettings.apply(host.app, newArgs);
                    case "relaunch":
                        return host.app.relaunch();
                    case "exit":
                        if (g.isMaximized) {
                            g.unmaximize();
                        }
                        return host.app.exit.apply(host.app, newArgs);
                    case "quit":
                        return host.app.quit();
                }
            }), host.ipcMain.handle("window", (function(e, t) {
                for (var n, r, o = arguments.length, i = new Array(o > 2 ? o - 2 : 0), a = 2; a < o; a++) i[a - 2] = arguments[a];
                switch (t) {
                    case "close":
                        return g.close();
                    case "minimize":
                        return g.minimize();
                    case "maximize":
                        return g.maximize();
                    case "unmaximize":
                        return g.unmaximize();
                    case "setAlwaysOnTop":
                        return (n = g).setAlwaysOnTop.apply(n, i);
                    case "isVisible":
                        return g.isVisible();
                    case "isMaximized":
                        return g.isMaximized();
                    case "setFullScreen":
                        return (r = g).setFullScreen.apply(r, i);
                    case "reload":
                        return g.reload()
                }
            })), g.on("hide", (function() {
                g.webContents.send("window-event", "hide")
            })), g.on("show", (function() {
                "darwin" === process.platform && host.app.dock.show(), g.webContents.send("window-event", "show")
            })), g.on("close", (function(e) {
                if (host.app.isQuiting) {
                    if (g.isMaximized) {
                        g.unmaximize();
                    }
                    host.globalShortcut.unregisterAll();
                    host.app.exit();
                } else {
                    if (e.preventDefault(), "darwin" === process.platform && g.isFullScreen()) return void g.setFullScreen(!1);
                    g.webContents.send("window-event", "close"), toolBar ? (g.blur(), g.hide(), "darwin" === process.platform && host.app.dock.hide()) : g.minimize()
                }
                return !1
            })), g.on("maximize", (function(e) {
                g.webContents.send("window-event", "maximize")
            })), g.on("unmaximize", (function(e) {
                g.webContents.send("window-event", "unmaximize")
            })), g.on("enter-full-screen", (function(e) {
                g.webContents.send("window-event", "enter-full-screen")
            })), g.on("leave-full-screen", (function(e) {
                g.webContents.send("window-event", "leave-full-screen")
            })), g.on("session-end", (function(e) {
                if (g.isMaximized) {
                    g.unmaximize();
                }
                e.preventDefault(), g.webContents.send("app-exit")
            })), host.ipcMain.handle("webContent", (function(e, t) {
                if ("toggleDevTools" === t) return g.webContents.toggleDevTools()
            })), host.ipcMain.handle("dialog", (r = l()(p().mark((function e(t, n) {
                var r, o, i, a = arguments;
                return p().wrap((function(e) {
                    for (;;) switch (e.prev = e.next) {
                        case 0:
                            for (r = a.length, o = new Array(r > 2 ? r - 2 : 0), i = 2; i < r; i++) o[i - 2] = a[i];
                            e.t0 = n, e.next = "showMessageBox" === e.t0 ? 4 : "showOpenDialogSync" === e.t0 ? 7 : 8;
                            break;
                        case 4:
                            return e.next = 6, host.dialog.showMessageBox.apply(host.dialog, [g].concat(o));
                        case 6:
                            return e.abrupt("return", e.sent);
                        case 7:
                            return e.abrupt("return", host.dialog.showOpenDialogSync.apply(host.dialog, [g].concat(o)));
                        case 8:
                        case "end":
                            return e.stop()
                    }
                }), e)
            }))), function(e, t) {
                return r.apply(this, arguments)
            })), host.ipcMain.handle("globalShortcut", (function(e, t) {
                for (var n = arguments.length, r = new Array(n > 2 ? n - 2 : 0), o = 2; o < n; o++) r[o - 2] = arguments[o];
                switch (t) {
                    case "register":
                        return host.globalShortcut.register(r[0], (function() {
                            g.webContents.send("shortcut-pressed", r[0])
                        }));
                    case "unregister":
                        return host.globalShortcut.unregister.apply(host.globalShortcut, r);
                    case "isRegistered":
                        return host.globalShortcut.isRegistered.apply(host.globalShortcut, r)
                }
            })), host.ipcMain.handle("nativeTheme", (function(e, t) {
                if ("shouldUseDarkColors" === t) return host.nativeTheme.shouldUseDarkColors
            })), host.nativeTheme.on("updated", (function() {
                g.webContents.send("native-theme-updated", host.nativeTheme.shouldUseDarkColors)
            })), host.ipcMain.handle("powerSaveBlocker", (function(e, t) {
                for (var n, r, o = arguments.length, i = new Array(o > 2 ? o - 2 : 0), a = 2; a < o; a++) i[a - 2] = arguments[a];
                switch (t) {
                    case "start":
                        return (n = powerSaveBlocker).start.apply(n, i);
                    case "stop":
                        return (r = powerSaveBlocker).stop.apply(r, i)
                }
            })), host.ipcMain.on("set-allow-unsafe-urls", (function(e, t) {
                I = t
            })), g.setTouchBar(new k({
                items: [new C({
                    label: "General",
                    backgroundColor: "#505050",
                    click: function() {
                        g.webContents.send("menu-item-change", "general")
                    }
                }), new C({
                    label: "Proxies",
                    backgroundColor: "#505050",
                    click: function() {
                        g.webContents.send("menu-item-change", "proxy")
                    }
                }), new C({
                    label: "Profiles",
                    backgroundColor: "#505050",
                    click: function() {
                        g.webContents.send("menu-item-change", "server")
                    }
                }), new C({
                    label: "Logs",
                    backgroundColor: "#505050",
                    click: function() {
                        g.webContents.send("menu-item-change", "log")
                    }
                }), new C({
                    label: "连接",
                    backgroundColor: "#505050",
                    click: function() {
                        g.webContents.send("menu-item-change", "connection")
                    }
                }), new C({
                    label: "Settings",
                    backgroundColor: "#505050",
                    click: function() {
                        g.webContents.send("menu-item-change", "setting")
                    }
                }), new C({
                    label: "Feedback",
                    backgroundColor: "#505050",
                    click: function() {
                        g.webContents.send("menu-item-change", "about")
                    }
                })]
            })), host.powerMonitor.on("suspend", (function() {
                g.webContents.send("power-event", "suspend")
            })), host.powerMonitor.on("resume", (function() {
                g.webContents.send("power-event", "resume")
            })), host.ipcMain.handle("window-control", (function(e, t) {
                switch (t) {
                    case "hide":
                        host.app.quit();
                        break;
                    case "show":
                        Launch();
                        break;
                    case "show-or-hide":
                        if (g.isVisible() && g.isFocused()) {
                            host.app.quit();
                        } else {
                            Launch();
                        };
                    default:
                        host.app.quit();
                }
            })), host.ipcMain.on("cleanup-done", (function(e) {
                host.app.isQuiting = !0, host.app.quit()
            })), host.ipcMain.on("status-changed", (function(e, t) {
                try {
                    "darwin" !== process.platform && toolBar.setImage(t)
                } catch (e) {}
            })), host.ipcMain.on("show-notification", (function(e, t) {
                var n = M.join(global.__static, "imgs/logo_64.png"),
                    notification = new host.Notification(b(b({}, t), {}, {
                        icon: "darwin" !== process.platform ? host.nativeImage.createFromPath(n) : null
                    })),
                    o = t.folder,
                    i = t.url;
                o && notification.on("click", (function() {
                    host.shell.openPath(t.folder)
                })), i && notification.on("click", (function() {
                    host.shell.openExternal(i)
                })), notification.show()
            })), host.ipcMain.on("clash-core-info", (function(e, t) {
                var n = t.port,
                    r = t.secret;
                n > 0 && (P = f().create({
                    baseURL: "http://127.0.0.1:".concat(n, "/"),
                    timeout: 5e3,
                    headers: {
                        Authorization: "Bearer ".concat(r)
                    }
                }))
            }));
            var o;
            var a = {
                systemProxyChecked: false,
                tunModeChecked: false,
                mixinChecked: false,
                isReady: false,
                menuMode: "",
                menuStyle: 0,
                isShowDelayIcon: false
            };
            /**
             * @param {string} event
             * @return {?}
             */
            var s = function(event) {
                return host.nativeImage.createFromPath(M.join(__static, "imgs", "tray-proxy-".concat(event, ".png"))).resize({
                    width: 8,
                    height: 8
                });
            };
            var u = (s("default"), s("online"));
            var d = s("offline");
            /** @type {function (): ?} */
            var m = (o = l()(p().mark(function e$$13() {
                var samePartsLength;
                var radixToPower;
                var result;
                var path;
                var payload;
                var l;
                var config;
                var pdataOld;
                var events;
                var sort;
                var rule;
                var queuelen;
                return p().wrap(function(self) {
                    for (;;) {
                        switch (self.prev = self.next) {
                            case 0:
                                if (samePartsLength = [], self.prev = 1, j() && 2 !== !a.menuStyle) {
                                    /** @type {number} */
                                    self.next = 12;
                                    break;
                                }
                                return self.next = 5, Promise.all([P.get("/proxies"), P.get("/providers/proxies")]);
                            case 5:
                                radixToPower = self.sent;
                                result = i()(radixToPower, 2);
                                path = result[0];
                                payload = result[1];
                                l = (null == path ? void 0 : path.data) || {};
                                config = l.proxies;
                                pdataOld = (null == payload ? void 0 : payload.data) || {};
                                events = pdataOld.providers;
                                if (config) {
                                    (sort = Object.entries(config).reduce(function(env, layers) {
                                        var error = i()(layers, 2);
                                        var errorName = error[0];
                                        var params = error[1];
                                        return "Selector" === (params || {}).type ? [].concat(t()(env), [{
                                            name: errorName,
                                            all: params.all,
                                            now: params.now
                                        }]) : env;
                                    }, [])).sort(function(pkg, t) {
                                        var $ = config.GLOBAL.all;
                                        return $.findIndex(function(moduleName) {
                                            return moduleName === pkg.name;
                                        }) - $.findIndex(function(type) {
                                            return type === t.name;
                                        });
                                    });
                                    rule = Object.entries(events).reduce(function(env, owner) {
                                        var unlock = i()(owner, 2);
                                        var value = (unlock[0], (unlock[1] || {}).proxies);
                                        var computed = void 0 === value ? [] : value;
                                        return [].concat(t()(env), t()(computed));
                                    });
                                    samePartsLength = sort.map(function(result) {
                                        var text = result.name;
                                        var deps = result.all;
                                        var id = result.now;
                                        return {
                                            label: text,
                                            submenu: deps.map(function(name) {
                                                var me = rule.find(function(v) {
                                                    return v.name === name;
                                                }) || [];
                                                return {
                                                    label: name,
                                                    type: "radio",
                                                    checked: name === id,
                                                    icon: a.isShowDelayIcon ? me.alive ? u : d : null,
                                                    /**
                                                     * @return {undefined}
                                                     */
                                                    click: function() {
                                                        if (P) {
                                                            P.put("/proxies/".concat(encodeURIComponent(text)), {
                                                                name: name
                                                            }).then(function(jqXHR) {
                                                                if (204 === jqXHR.status) {
                                                                    g.webContents.send("persist-selected-proxy");
                                                                    g.webContents.send("break-connections", text);
                                                                }
                                                            }).catch(function(dataAndEvents) {});
                                                        }
                                                    }
                                                };
                                            })
                                        };
                                    });
                                };
                            case 12:
                                /** @type {number} */
                                self.next = 16;
                                break;
                            case 14:
                                /** @type {number} */
                                self.prev = 14;
                                self.t0 = self.catch(1);
                            case 16:
                                return queuelen = [
                                    [{
                                        label: "\u4ee3\u7406\u7ec4", //代理组
                                        enabled: false
                                    }].concat(t()(samePartsLength)), [{
                                        label: "\u4ee3\u7406\u7ec4", //代理组
                                        submenu: samePartsLength
                                    }],
                                    []
                                ][a.menuStyle || 0], self.abrupt("return", [{
                                    label: "\u4eea\u8868\u76d8", //仪表盘
                                    click: Launch
                                }, {
                                    label: "\u8fd0\u884c\u4efb\u52a1\u680f\u811a\u672c", //运行任务栏脚本
                                    visible: "linux" !== process.platform,
                                    /**
                                     * @return {?}
                                     */
                                    click: function() {
                                        return g.webContents.send("run-tray-script");
                                    }
                                }, {
                                    type: "separator"
                                }, {
                                    label: "&\u7cfb\u7edf\u4ee3\u7406",
                                    type: "checkbox",
                                    id: "system-proxy",
                                    checked: a.systemProxyChecked,
                                    enabled: a.isReady,
                                    visible: "linux" !== process.platform,
                                    /**
                                     * @param {Element} e
                                     * @return {undefined}
                                     */
                                    click: function(e) {
                                        var status = e.checked;
                                        g.webContents.send("system-proxy-changed", status);
                                    }
                                }, {
                                    label: "TUN \u6a21\u5f0f",
                                    type: "checkbox",
                                    id: "tun",
                                    enabled: a.isReady,
                                    checked: a.tunModeChecked,
                                    /**
                                     * @param {Element} e
                                     * @return {undefined}
                                     */
                                    click: function(e) {
                                        var status = e.checked;
                                        g.webContents.send("tun-changed", status);
                                    }
                                }, {
                                    label: "\u6df7\u5408\u914d\u7f6e",
                                    type: "checkbox",
                                    id: "mixin",
                                    enabled: a.isReady,
                                    checked: a.mixinChecked,
                                    /**
                                     * @param {Element} e
                                     * @return {undefined}
                                     */
                                    click: function(e) {
                                        var status = e.checked;
                                        g.webContents.send("mixin-changed", status);
                                    }
                                }, {
                                    type: "separator"
                                }, {
                                    label: "\u4ee3\u7406\u6a21\u5f0f",
                                    id: "mode",
                                    enabled: false
                                }, {
                                    label: "\u5168\u5c40",
                                    type: "radio",
                                    id: "mode-global",
                                    enabled: a.isReady,
                                    checked: "global" === a.menuMode,
                                    /**
                                     * @return {?}
                                     */
                                    click: function() {
                                        return g.webContents.send("mode-changed", "global");
                                    }
                                }, {
                                    label: "\u89c4\u5219",
                                    type: "radio",
                                    id: "mode-rule",
                                    enabled: a.isReady,
                                    checked: "rule" === a.menuMode,
                                    /**
                                     * @return {?}
                                     */
                                    click: function() {
                                        return g.webContents.send("mode-changed", "rule");
                                    }
                                }, {
                                    label: "\u76f4\u8fde",
                                    type: "radio",
                                    id: "mode-direct",
                                    enabled: a.isReady,
                                    checked: "direct" === a.menuMode,
                                    /**
                                     * @return {?}
                                     */
                                    click: function() {
                                        return g.webContents.send("mode-changed", "direct");
                                    }
                                }, {
                                    label: "\u811a\u672c",
                                    type: "radio",
                                    id: "mode-script",
                                    enabled: a.isReady,
                                    checked: "script" === a.menuMode,
                                    /**
                                     * @return {?}
                                     */
                                    click: function() {
                                        return g.webContents.send("mode-changed", "script");
                                    }
                                }, {
                                    type: "separator"
                                }].concat(t()(queuelen), [{
                                    type: "separator"
                                }, {
                                    label: "\u8fde\u63a5",
                                    id: "connection",
                                    enabled: false
                                }, {
                                    label: "\u5173\u95ed\u5168\u90e8",
                                    type: "normal",
                                    enabled: a.isReady,
                                    /**
                                     * @return {undefined}
                                     */
                                    click: function() {
                                        P.delete("/connections");
                                    }
                                }, {
                                    type: "separator"
                                }, {
                                    label: "\u66f4\u591a",
                                    submenu: [{
                                        label: "\u5207\u6362Dev\u5de5\u5177",
                                        /**
                                         * @return {undefined}
                                         */
                                        click: function() {
                                            g.webContents.toggleDevTools();
                                        }
                                    }, {
                                        label: "\u5c06\u4eea\u8868\u677f\u79fb\u81f3\u6700\u8fd1\u7684\u663e\u793a\u5668",
                                        /**
                                         * @return {undefined}
                                         */
                                        click: function() {
                                            g.setBounds(B(g.getBounds()));
                                            Launch();
                                        }
                                    }, {
                                        label: "\u91cd\u542f",
                                        /**
                                         * @return {undefined}
                                         */
                                        click: function() {
                                            if (g.isMaximized) {
                                                g.unmaximize();
                                            }
                                            host.app.relaunch();
                                            host.app.exit(0);
                                        }
                                    }, {
                                        label: "\u5f3a\u5236\u9000\u51fa",
                                        /**
                                         * @return {undefined}
                                         */
                                        click: function() {
                                            /** @type {boolean} */
                                            host.app.isQuiting = true;
                                            host.app.quit();
                                        }
                                    }]
                                }, {
                                    type: "separator"
                                }, {
                                    label: "\u9000\u51fa",
                                    /**
                                     * @return {?}
                                     */
                                    click: function() {
                                        if (g.isMaximized) {
                                            g.unmaximize();
                                        }
                                        return g.webContents.send("app-exit");
                                    }
                                }]));
                            case 18:
                                ;
                            case "end":
                                return self.stop();
                        }
                    }
                }, e$$13, null, [
                    [1, 14]
                ]);
            })), function() {
                return o.apply(this, arguments);
            });
            /**
             * @return {undefined}
             */
            var S = function() {
                var restoreScript;
                if (!toolBar) {
                    var udataCur = host.nativeImage.createFromPath(M.join(__static, "imgs", "logo_64_eyes.png")).resize({
                        width: 24,
                        height: 24
                    });
                    udataCur.setTemplateImage(true);
                    var r20 = M.join(__static, "tray", "win", "tray_normal.ico");
                    var rreturn = M.join(__static, "imgs", "logo_reverse_32.png");
                    var trayOptions = (restoreScript = {}, c()(restoreScript, "win32", r20), c()(restoreScript, "darwin", udataCur), c()(restoreScript, "linux", rreturn), restoreScript)[process.platform];
                    (toolBar = new host.Tray(trayOptions)).setToolTip("Clash for Windows");
                    toolBar.on("right-click", function() {
                        m().then(function(deepDataAndEvents) {
                            toolBar.popUpContextMenu(host.Menu.buildFromTemplate(deepDataAndEvents));
                        });
                    });
                    toolBar.on("click", function() {
                        if ("darwin" !== process.platform) {
                            Launch();
                        }
                    });
                    toolBar.on("mouse-down", Launch);
                }
            };
            S(), host.ipcMain.handle("tray-create-destroy", function(dataAndEvents) {
                var method = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "create";
                if ("create" === method) {
                    S();
                }
                if ("destroy" === method) {
                    if (toolBar) {
                        toolBar.destroy();
                        /** @type {null} */
                        toolBar = null;
                    }
                }
            });
            var O = host.Menu.buildFromTemplate([{
                label: "仪表盘",
                click: Launch
            }, {
                type: "separator"
            }, {
                label: "TUN 模式",
                type: "checkbox",
                id: "tun",
                enabled: !1,
                click: function(e) {
                    var t = e.checked;
                    g.webContents.send("tun-changed", t)
                }
            }, {
                label: "混合配置",
                type: "checkbox",
                id: "mixin",
                enabled: !1,
                click: function(e) {
                    var t = e.checked;
                    g.webContents.send("mixin-changed", t)
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
                    return g.webContents.send("mode-changed", "global")
                }
            }, {
                label: "规则",
                type: "radio",
                id: "mode-rule",
                enabled: a.isReady,
                checked: "rule" === a.menuMode,
                click: function() {
                    return g.webContents.send("mode-changed", "rule")
                }
            }, {
                label: "直连",
                type: "radio",
                id: "mode-direct",
                enabled: !1,
                click: function() {
                    return g.webContents.send("mode-changed", "direct")
                }
            }, {
                label: "脚本",
                type: "radio",
                id: "mode-script",
                enabled: !1,
                click: function() {
                    return g.webContents.send("mode-changed", "script")
                }
            }, {
                type: "separator"
            }, {
                label: "更多",
                submenu: [{
                    label: "切换Dev工具",
                    click: function() {
                        g.webContents.toggleDevTools()
                    }
                }, {
                    label: "将仪表板移至最近的显示器",
                    click: function() {
                        g.setBounds(B(g.getBounds())), Launch()
                    }
                }, {
                    label: "重启",
                    click: function() {
                        if (g.isMaximized) {
                            g.unmaximize();
                        }
                        host.app.relaunch(), host.app.exit(0)
                    }
                }, {
                    label: "强制退出",
                    click: function() {
                        host.app.isQuiting = !0, host.app.quit()
                    }
                }]
            }, {
                type: "separator"
            }, {
                label: "退出",
                click: function() {
                    if (g.isMaximized) {
                        g.unmaximize();
                    }
                    return g.webContents.send("app-exit")
                }
            }]);

            function D() {
                j() && toolBar && toolBar.setContextMenu(O)
            }
            D(), host.ipcMain.on("clash-core-status-change", (function(e, t) {
                if (a.isReady = !0, j()) {
                    var n = O.getMenuItemById("system-proxy");
                    n && (n.enabled = 1 !== t);
                    var r = O.getMenuItemById("mixin");
                    r && (r.enabled = 1 !== t);
                    var o = O.getMenuItemById("tun");
                    o && (o.enabled = 1 !== t), ["global", "rule", "direct", "script"].forEach((function(e) {
                        var n = O.getMenuItemById("mode-".concat(e));
                        n && (n.enabled = 1 !== t)
                    })), D()
                }
            })), host.ipcMain.handle("tray-proxies-style", (function(e, t) {
                if (t === 0) {
                    a.menuStyle = 1;
                } else if (t === 1) {
                    a.menuStyle = 0;
                } else {
                    a.menuStyle = 2
                }
            })), host.ipcMain.handle("tray-proxies-icon", (function(e, t) {
                a.isShowDelayIcon = t
            })), host.ipcMain.on("mode-changed", (function(e, t) {
                if (a.menuMode = t, j()) {
                    var n = "mode-".concat(t),
                        r = O.getMenuItemById(n);
                    r && (r.checked = !0), D()
                }
            })), host.ipcMain.on("system-proxy-changed", (function(e, t) {
                a.systemProxyChecked = t
            })), host.ipcMain.on("mixin-changed", (function(e, t) {
                if (a.mixinChecked = t, j()) {
                    var n = O.getMenuItemById("mixin");
                    n && (n.checked = t), D()
                }
            })), host.ipcMain.on("tun-changed", (function(e, t) {
                if (a.tunModeChecked = t, j()) {
                    var n = O.getMenuItemById("tun");
                    n && (n.checked = t), D()
                }
            })), host.ipcMain.on("enhanced-tray-click", Launch), host.ipcMain.on("speed-update", (function(e, t, n) {
                var r = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : "#fff";
                try {
                    if (toolBar) {
                        var o = host.nativeImage.createFromDataURL(t);
                        if ("win32" === process.platform) {
                            if (60 === n) return void(y && (y.destroy(), y = null, w = 0));
                            var i = o.crop({
                                x: 0,
                                y: 0,
                                width: n + 8,
                                height: 69
                            });
                            var a = M.join(host.app.getPath("temp"), "cfw-sub.html");
                            var c = i.getSize();
                            var s = c.width;
                            var l = c.height;
                            _.writeFileSync(a, '\n          <body style="position:relative;background-color:'.concat(r, ';overflow:hidden;-webkit-app-region:drag;margin:0;width:100%;height:100%;box-sizing:border-box;">\n            <img id="img" style="height:100%;width:100%;" src="').concat(i.toDataURL(), '" />\n            <div style="position:absolute;width:50%;height:100%;top:0;left:50%;-webkit-app-region:no-drag;" onclick="handleClick()"></div>\n          </body>\n          <script>\n            const { ipcRenderer } = require(\'electron\');\n            ipcRenderer.on(\'speed-update-win\', (e, url, bgc) => {\n              document.getElementById("img").src = url;\n              document.body.style.backgroundColor = bgc;\n            })\n            const handleClick = () => {\n              ipcRenderer.send(\'enhanced-tray-click\');\n            }\n          \x3c/script>\n          ')),
                                y || (y = new host.BrowserWindow({
                                    show: true,
                                    alwaysOnTop: true,
                                    closable: false,
                                    focusable: false,
                                    frame: false,
                                    useContentSize: true,
                                    maximizable: false,
                                    transparent: true,
                                    minimizable: false,
                                    resizable: false,
                                    webPreferences: {
                                        nodeIntegration: true,
                                        contextIsolation: false
                                    }
                                })).loadFile(a), y.show(), y.webContents.send("speed-update-win", i.toDataURL(), r), w !== n && y.setBounds({
                                    height: Math.ceil(l / 2.8),
                                    width: Math.ceil(s / 2.8)
                                }), w = n
                        }
                        if ("darwin" === process.platform) {
                            var u = ("" === t ? host.nativeImage.createFromPath(M.join(__static, "imgs", "logo_64_eyes.png")) : o.crop({
                                x: 0,
                                y: 0,
                                width: n,
                                height: 69
                            })).resize({
                                height: 23
                            });
                            u.setTemplateImage(!0), toolBar.setImage(u)
                        }
                    }
                } catch (e) {}
            }));
            var E, z, F = [{
                label: host.app.name,
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
                    click: function() {}
                }, {
                    type: "separator"
                }, {
                    label: "退出 Clash for Windows",
                    accelerator: "Command+Q",
                    click: function() {
                        if (g.isMaximized) {
                            g.unmaximize();
                        }
                        g.webContents.send("app-exit")
                    }
                }]
            }, {
                role: "editMenu"
            }, {
                label: "View",
                submenu: [{
                    role: "reload"
                }, {
                    role: "forceReload"
                }, {
                    role: "toggleDevTools"
                }, {
                    type: "separator"
                }, {
                    role: "resetZoom"
                }, {
                    role: "zoomIn",
                    accelerator: "CmdOrCtrl+="
                }, {
                    role: "zoomOut"
                }, {
                    type: "separator"
                }, {
                    role: "togglefullscreen"
                }]
            }, {
                role: "windowMenu"
            }, {
                role: "help",
                submenu: [{
                    label: "Github",
                    click: (z = l()(p().mark((function e() {
                        var t, r;
                        return p().wrap((function(e) {
                            for (;;) switch (e.prev = e.next) {
                                case 0:
                                    return t = n(298), r = t.shell, e.next = 3, r.openExternal("https://github.com/Fndroid/clash_for_windows_pkg");
                                case 3:
                                case "end":
                                    return e.stop()
                            }
                        }), e)
                    }))), function() {
                        return z.apply(this, arguments)
                    })
                }, {
                    label: "Document",
                    click: (E = l()(p().mark((function e() {
                        var t, r;
                        return p().wrap((function(e) {
                            for (;;) switch (e.prev = e.next) {
                                case 0:
                                    return t = n(298), r = t.shell, e.next = 3, r.openExternal("https://docs.cfw.lbyczf.com/");
                                case 3:
                                case "end":
                                    return e.stop()
                            }
                        }), e)
                    }))), function() {
                        return E.apply(this, arguments)
                    })
                }]
            }];
            host.Menu.setApplicationMenu(host.Menu.buildFromTemplate(F)), host.ipcMain.handle("wlan-status-wanted", R)
        }

        function R() {
            if (g) try {
                n(354).addEventListener("wlan-status-changed", (function(e, t) {
                    e ? g.webContents.send("wlan-status-listen-error", JSON.stringify(e)) : g.webContents.send("wlan-status-changed", t)
                }))
            } catch (e) {
                g.webContents.send("wlan-status-listen-error", e.message)
            }
        }

        function RelaunchApp() {
            if (g.isMaximized) {
                g.unmaximize();
            }
            host.app.relaunch(), host.app.exit(0)
        }
        var E, z = host.app.requestSingleInstanceLock();

        function B(e) {
            var t = e.x,
                n = e.y,
                r = host.screen.getAllDisplays().find((function(e) {
                    var r = e.bounds;
                    if (r) {
                        var o = r.x,
                            i = r.y,
                            a = r.width,
                            c = r.height;
                        return S.inRange(t, o, o + a) && S.inRange(n, i, i + c)
                    }
                }));
            if (!r) {
                var o = host.screen.getDisplayNearestPoint({
                    x: t,
                    y: n
                }).bounds;
                if (o) return {
                    x: o.x,
                    y: o.y
                }
            }
            return {
                x: t,
                y: n
            }
        }
        host.app.setAppUserModelId("com.lbyczf.clashwin"), host.app.setAsDefaultProtocolClient("clash"), host.app.setName("Clash for Windows"), host.app.setAboutPanelOptions({
            version: ""
        }), host.app.on("open-url", (function(e, t) {
            g.webContents.send("app-open", [t])
        })), z ? (host.app.on("second-instance", function(dataAndEvents, payload, deepDataAndEvents) {
            if (g) {
                g.webContents.send("app-open", payload);
                if (g.isMinimized()) {
                    g.restore();
                }
                Launch();
            }
        }), host.app.on("ready", (function() {
            n(113).init(), host.powerMonitor.on("shutdown", (function(e) {
                e.preventDefault(), g.webContents.send("app-exit"), setTimeout((function() {
                    if (g.isMaximized) {
                        g.unmaximize();
                    }
                    host.app.isQuiting = !0, host.app.quit()
                }), 5e3)
            })), D()
        }))) : host.app.quit(), host.app.on("activate", (function() {
            null === g ? D() : Launch()
        })), host.app.on("certificate-error", (E = l()(p().mark((function e(t, n, r, o, i, a) {
            var c, s;
            return p().wrap((function(e) {
                for (;;) switch (e.prev = e.next) {
                    case 0:
                        c = fales;
                        try {
                            s = new URL(r), c = "raw.githubusercontent.com" === s.host && "/Fndroid/ads/master/ads_v2.json" === s.path
                        } catch (e) {}
                        if (!c && !I.includes(r)) {
                            e.next = 7;
                            break
                        }
                        t.preventDefault(), a(!0), e.next = 13;
                        break;
                    case 7:
                        return e.next = 9, host.dialog.showMessageBox({
                            type: "warning",
                            buttons: ["Trust", "Cancel"],
                            title: "Certificate Error",
                            message: "Failed verify the certificate for ".concat(r, ". This may be because the certificate is self-signed or the certificate authority is not recognized. Do you want to trust this certificate?")
                        });
                    case 9:
                        0 === e.sent.response && host.dialog.showCertificateTrustDialog(g, {
                            certificate: i,
                            message: "If you keep seeing this error, you need to go to Keychain APP to trust the certificate."
                        }).catch((function(e) {
                            console.error(e)
                        })), a(!1);
                    case 13:
                    case "end":
                        return e.stop()
                }
            }), e)
        }))), function(e, t, n, r, o, i) {
            return E.apply(this, arguments)
        }))
    })(), module.exports = r
})();