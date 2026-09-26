"use strict";

function createHomePageComponents({
    defineComponent,
    Vuex,
    lodash,
    draggable,
    cache,
    keys,
    connectedStatus,
    electron,
    path,
    fs,
    requireFromString,
    scheduler,
    Hint,
    getLanguage
}) {
    const ClashTrafficView = defineComponent({
        data() {
            return {
                speed: { up: 0, down: 0 },
                client: null,
                scriptResult: "",
                intervalID: null,
                trayIconImg: null,
                canvas: null,
                renderedData: null
            };
        },
        watch: {
            clashStatus(value) {
                if (value === connectedStatus) {
                    this.setupRequest();
                    this.updateInterval();
                }
            },
            isWindowShow() { this.setupRequest(); },
            isAppSuspend(value) { if (!value) this.setupRequest(); },
            "settings.trayText"() { this.updateInterval(); },
            "settings.trayScriptPath"() { this.updateInterval(); },
            "settings.trayScriptInterval"() { this.updateInterval(); },
            "settings.trayScriptManualRunTime"() { this.updateInterval(); },
            "settings.trayOrders": {
                deep: true,
                handler(value, previousValue) {
                    if (!lodash.isEqual(value, previousValue)) this.updateInterval();
                }
            }
        },
        computed: {
            ...Vuex.mapState({
                confData: state => state.app.confData,
                clashStatus: state => state.app.clashStatus,
                status: state => state.app.status,
                shouldUseDarkTheme: state => state.app.shouldUseDarkTheme,
                isWindowShow: state => state.app.isWindowShow,
                isAppSuspend: state => state.app.isAppSuspend,
                isSystemProxyOn: state => state.app.isSystemProxyOn,
                mode: state => state.app.mode
            }),
            ...Vuex.mapGetters(["resourcesPath", "clashWSClient"]),
            trayDisabled() {
                const orders = this.settings.trayOrders || [[], []];
                return orders[0].length === 0 || (orders[0].length === 1 && orders[0][0] === "icon");
            },
            finalText() {
                return (this.settings.trayText || "") || this.scriptResult;
            },
            colors() {
                return {
                    light: ["#fff", "#000"],
                    dark: ["#2c2a38", "rgb(255, 255, 255)"],
                    red: ["#303030", "#ffffff"],
                    2077: ["#136377", "#fcec0c"]
                }[this.theme];
            }
        },
        methods: {
            iconImage(source) {
                const image = new Image(69, 69);
                image.src = source;
                return image;
            },
            withUnit(value, precision = 2, promoteLargeValue = false) {
                const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
                let unitIndex = 0;
                while (Math.trunc(value / 1024) && unitIndex < units.length - 1) {
                    value /= 1024;
                    unitIndex++;
                }
                if (promoteLargeValue && value > 999 && unitIndex < units.length - 1) {
                    unitIndex++;
                    value /= 1024;
                }
                return { speed: unitIndex === 0 ? value : value.toFixed(precision), unit: units[unitIndex] };
            },
            stopRequest() {
                if (this.client && this.client.readyState !== WebSocket.CLOSED && this.client.readyState !== WebSocket.CONNECTING) {
                    this.client.terminate();
                    this.client = null;
                }
                this.trayIconImg = null;
            },
            trayRenderData(orders, transparent, foreground) {
                const data = { trayColorTransparent: transparent, trayColorForeground: foreground };
                for (const item of orders[0]) {
                    if (item === "icon") data.icon = this.trayIconImg;
                    else if (item === "traffic") data.speed = this.speed;
                    else if (item === "status") {
                        data.mode = this.mode[0].toUpperCase();
                        data.isSystemProxyOn = this.isSystemProxyOn;
                    } else if (item === "text") data.text = this.finalText;
                }
                return data;
            },
            setupRequest() {
                this.stopRequest();
                if (!this.isWindowShow && this.trayDisabled) return;

                const client = this.clashWSClient("traffic");
                if (!this.trayIconImg) {
                    this.trayIconImg = this.iconImage(path.join(this.resourcesPath, "static/imgs/logo_64_eyes.png"));
                }
                if (!client) {
                    setTimeout(() => this.setupRequest(), 2000);
                    return;
                }
                const context = this.canvas.getContext("2d");
                client.on("message", payload => {
                    this.speed = JSON.parse(payload);
                    const {
                        trayOrders = [[], []],
                        trayColorTransparent,
                        trayColorForeground = "#fff"
                    } = this.settings;
                    const renderData = this.trayRenderData(trayOrders, trayColorTransparent, trayColorForeground);
                    if (lodash.isEqual(this.renderedData, renderData)) return;
                    if (this.trayDisabled) {
                        electron.ipcRenderer.send("speed-update", "", 60, "");
                    } else {
                        let offset = 0;
                        const upload = this.withUnit(this.speed.up, 0, true);
                        const download = this.withUnit(this.speed.down, 0, true);
                        const foreground = trayColorTransparent ? trayColorForeground : this.colors[1];
                        const drawIcon = () => {
                            context.drawImage(this.trayIconImg, offset, 0, 69, 69);
                            offset += 69;
                        };
                        const drawTraffic = () => {
                            context.textAlign = "right";
                            context.fillStyle = foreground;
                            context.font = "26px sans-serif";
                            context.lineWidth = 2;
                            context.strokeStyle = foreground;
                            context.fillText(`${upload.speed} ${upload.unit}`, offset + 145, 30);
                            context.fillText(`${download.speed} ${download.unit}`, offset + 145, 58);
                            context.textAlign = "left";
                            context.beginPath();
                            context.moveTo(offset + 5, 31);
                            context.lineTo(offset + 12, 22);
                            context.lineTo(offset + 19, 31);
                            if (this.speed.up > this.speed.down) context.fill();
                            context.stroke();
                            context.beginPath();
                            context.moveTo(offset + 19, 38);
                            context.lineTo(offset + 12, 47);
                            context.lineTo(offset + 5, 38);
                            if (this.speed.up < this.speed.down) context.fill();
                            context.stroke();
                            offset += 150;
                        };
                        const drawStatus = () => {
                            context.font = "26px sans-serif";
                            context.fillStyle = foreground;
                            context.fillText(this.mode[0].toUpperCase(), offset + 5, 58);
                            if (this.isSystemProxyOn) context.fillText("S", offset + 5, 30);
                            offset += 30;
                        };
                        const drawText = () => {
                            context.fillStyle = foreground;
                            const left = offset + 10;
                            const text = this.finalText;
                            let width;
                            if (Array.isArray(text) && text.length >= 2) {
                                context.font = "26px sans-serif";
                                width = Math.max(context.measureText(text[0]).width, context.measureText(text[1]).width);
                                context.fillText(text[0], left, 30);
                                context.fillText(text[1], left, 58);
                            } else {
                                context.font = "40px sans-serif";
                                width = context.measureText(text).width;
                                context.fillText(text, left, 50);
                            }
                            offset += parseInt(width, 10) + 20;
                        };
                        const drawers = { icon: drawIcon, traffic: drawTraffic, status: drawStatus, text: drawText };
                        trayOrders[0].forEach(item => drawers[item]?.());
                        if (trayOrders[0].length === 0) drawIcon();
                        electron.ipcRenderer.send(
                            "speed-update",
                            this.canvas.toDataURL(),
                            this.trayDisabled ? 60 : offset,
                            trayColorTransparent ? "" : this.colors[0]
                        );
                        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    }
                    this.renderedData = this.trayRenderData(trayOrders, trayColorTransparent, trayColorForeground);
                });
                this.client = client;
            },
            updateInterval() {
                if (this.intervalID) clearInterval(this.intervalID);
                this.intervalID = null;
                this.scriptResult = "";
                const { trayText = "", trayScriptInterval, trayScriptPath, trayOrders } = this.settings;
                if (trayText !== "" || !trayScriptPath || !trayOrders[0].includes("text")) return null;
                const runScript = async () => {
                    const source = fs.readFileSync(trayScriptPath, "utf8");
                    const script = requireFromString(`'use strict';\n${source}`, trayScriptPath);
                    this.scriptResult = await script.run();
                };
                runScript();
                if (trayScriptInterval > 0) this.intervalID = setInterval(runScript, 1000 * trayScriptInterval);
                return null;
            }
        },
        mounted() {
            this.canvas = document.createElement("canvas");
            this.canvas.width = 10000;
            this.setupRequest();
            this.updateInterval();
        }
    }, function renderClashTraffic() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const upload = viewModel.withUnit(viewModel.speed.up);
        const download = viewModel.withUnit(viewModel.speed.down);
        const renderSpeed = (arrow, speed) => createElement("div", { staticClass: "grid" }, [createElement("div", [
            createElement("span", { staticClass: "bold-icon" }, [viewModel._v(arrow)]),
            viewModel._v(`\n      ${viewModel._s(speed.speed)}\n      `),
            createElement("span", { staticClass: "bold-icon" }, [viewModel._v(viewModel._s(speed.unit))])
        ])]);
        return createElement("div", { staticClass: "main-clash-traffic-view" }, [
            renderSpeed("↑", upload), viewModel._v(" "), renderSpeed("↓", download)
        ]);
    }, "4f5120b9");

    const RunTimeView = defineComponent({
        props: ["startTime"],
        data() { return { runningTime: "00 : 00 : 00", intervalId: null }; },
        methods: {
            calcRunTime(format = "hh : mm : ss") {
                const includesHours = format.includes("hh");
                const includesMinutes = format.includes("mm");
                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                const seconds = includesHours || includesMinutes ? elapsed % 60 : elapsed;
                const minutes = includesHours ? Math.floor(elapsed / 60) % 60 : Math.floor(elapsed / 60);
                const hours = Math.floor(elapsed / 3600);
                const pad = value => value < 10 ? `0${value}` : `${value}`;
                return format.replace("hh", pad(hours)).replace("mm", pad(minutes)).replace("ss", pad(seconds));
            },
            refreshTimeTicking() {
                this.intervalId = scheduler.add(() => {
                    this.runningTime = this.calcRunTime(this.settings.runTimeFormat || "hh : mm : ss");
                }, 1000);
            }
        },
        mounted() { this.refreshTimeTicking(); }
    }, function renderRunTime() {
        const viewModel = this;
        return viewModel._self._c("div", { attrs: { id: "main-run-time-view" } }, [
            viewModel._self._c("div", { staticClass: "timer-text" }, [viewModel._v(viewModel._s(viewModel.runningTime))])
        ]);
    }, "05e7144a");

    const MainMenu = defineComponent({
        props: ["startTime", "profileUpdateFailedURLs", "keyboardClickTimes"],
        data() {
            return { isAllowSort: false, isShowKeyboardShortcuts: false, keyboardShortcutsIntervalID: null };
        },
        components: { ClashTrafficView, RunTimeView, draggable, Hint },
        watch: {
            keyboardClickTimes() {
                this.isShowKeyboardShortcuts = true;
                if (this.keyboardShortcutsIntervalID) clearInterval(this.keyboardShortcutsIntervalID);
                this.keyboardShortcutsIntervalID = setInterval(() => {
                    this.isShowKeyboardShortcuts = false;
                    clearInterval(this.keyboardShortcutsIntervalID);
                }, 5000);
            }
        },
        computed: {
            ...Vuex.mapGetters(["menuItemsWithOrder", "clashGotClient"]),
            selectedIdx() { return this.tabs.findIndex(tab => tab.path === this.$route.path); },
            tabs: {
                get() { return this.menuItemsWithOrder; },
                set(value) {
                    cache.put(keys.MENU_ITEM_ORDER, value.map(tab => tab.title));
                    this.setMenuItems({ items: value });
                }
            }
        },
        methods: {
            ...Vuex.mapMutations({ setMenuItems: "SET_MENU_ITEMS" }),
            async handleRightClick(event) {
                this.$menu([{ text: getLanguage().reorder(), icon: "reorder", click: () => { this.isAllowSort = true; } }], event);
            },
            itemStyle(index) {
                const classes = [];
                if (this.isAllowSort) classes.push(`shaking${index % 3 + 1}`);
                if (this.selectedIdx === index) classes.push("selected");
                else classes.push("selected-none", "item-none");
                if (this.selectedIdx === index + 1) classes.push("selected-top");
                if (this.selectedIdx === index - 1) classes.push("selected-bottom");
                return classes;
            },
            itemClick(tab) { this.$router.replace({ path: tab.path }).catch(() => {}); }
        }
    }, function renderMainMenu() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        return createElement("div", {
            class: ["main-main-menu", "item-none", viewModel.isAllowSort ? "item-draggable" : ""],
            on: { contextmenu: viewModel.handleRightClick }
        }, [
            createElement("clash-traffic-view", { staticClass: "traffic" }),
            viewModel._v(" "),
            createElement("draggable", {
                ref: "list",
                staticClass: "menu",
                attrs: { animation: 200, "delay-on-touch-only": true, disabled: !viewModel.isAllowSort, "drag-class": "drag-item", "ghost-class": "ghost-item" },
                model: { value: viewModel.tabs, callback(value) { viewModel.tabs = value; }, expression: "tabs" }
            }, viewModel._l(viewModel.tabs, (tab, index) => createElement("li", {
                key: index,
                staticClass: "item",
                class: viewModel.itemStyle(index),
                on: { click() { return viewModel.itemClick(tab); } }
            }, [createElement("div", { staticClass: "clickable flex items-center justify-center gap-1" }, [
                createElement("span", {
                    staticClass: "text-xs absolute left-3 transition-all",
                    style: { left: viewModel.isShowKeyboardShortcuts ? "12px" : "-20px" }
                }, [viewModel._v(viewModel._s(index + 1))]),
                viewModel._v(" "),
                createElement("span", [viewModel._v(viewModel._s(tab.title))]),
                viewModel._v(" "),
                viewModel.profileUpdateFailedURLs.length > 0 && labels.profiles() === tab.title ? createElement("hint", {
                    attrs: { hint: "At least one profile failed to update while dashboard is closed.", position: "right" }
                }, [createElement("span", { staticClass: "icon text-sm text-[color:var(--proxy-item-latency-offline-c)]" }, [viewModel._v("error")])]) : viewModel._e()
            ], 1)])), 0),
            viewModel._v(" "),
            createElement("run-time-view", { staticClass: "running-time", attrs: { "start-time": viewModel.startTime } }),
            viewModel._v(" "),
            viewModel.isAllowSort ? createElement("div", {
                staticClass: "stop-btn", on: { click() { viewModel.isAllowSort = false; } }
            }, [viewModel._v(`\n    ${labels.stopSorting()}\n  `)]) : viewModel._e()
        ], 1);
    }, "149ea1bd");

    const StatusBar = defineComponent({
        data() { return { isWinMax: false, isPinned: false, isFullScreen: false }; },
        computed: {
            ...Vuex.mapState({
                mode: state => state.app.mode,
                updateDownloadProgress: state => state.app.updateDownloadProgress,
                isSystemProxyOn: state => state.app.isSystemProxyOn,
                isMixinEnable: state => state.app.isMixinEnable,
                isTunEnable: state => state.app.isTunEnable
            }),
            percent() { return this.updateDownloadProgress ? 100 * this.updateDownloadProgress : 0; },
            capMode() { return lodash.capitalize(this.mode); },
            titleText() {
                if (!this.settings?.titleBarText) return "";
                return this.settings.titleBarText
                    .replace("%mode%", this.mode)
                    .replace("%Mode%", this.capMode)
                    .replace("%tun%", this.isTunEnable ? "On" : "Off")
                    .replace("%systemProxy%", this.isSystemProxyOn ? "On" : "Off")
                    .replace("%mixin%", this.isMixinEnable ? "On" : "Off")
                    .replace(/%tun\?(.+?)\:(.+?)%/, this.isTunEnable ? "$1" : "$2")
                    .replace(/%systemProxy\?(.+?)\:(.+?)%/, this.isSystemProxyOn ? "$1" : "$2")
                    .replace(/%mixin\?(.+?)\:(.+?)%/, this.isMixinEnable ? "$1" : "$2");
            }
        },
        methods: {
            closeApp() { electron.ipcRenderer.invoke("app", "quit"); },
            miniApp() { electron.ipcRenderer.invoke("window", "minimize"); },
            maxApp() {
                if (this.isFullScreen) electron.ipcRenderer.invoke("window", "setFullScreen", false);
                else electron.ipcRenderer.invoke("window", this.isWinMax ? "unmaximize" : "maximize");
            },
            pinApp() {
                this.isPinned = !this.isPinned;
                electron.ipcRenderer.invoke("window", "setAlwaysOnTop", this.isPinned);
                cache.put(keys.IS_PIN_ENABLED, this.isPinned);
            }
        },
        async mounted() {
            const updateMaximized = async () => { this.isWinMax = await electron.ipcRenderer.invoke("window", "isMaximized"); };
            electron.ipcRenderer.on("window-event", async (_event, name) => {
                if (name === "maximize") this.isWinMax = true;
                else if (name === "unmaximize") this.isWinMax = false;
                else if (name === "enter-full-screen") this.isFullScreen = true;
                else if (name === "leave-full-screen") this.isFullScreen = false;
                if (name === "show") await updateMaximized();
            });
            this.isPinned = cache.get(keys.IS_PIN_ENABLED) || false;
            electron.ipcRenderer.invoke("window", "setAlwaysOnTop", this.isPinned);
            await updateMaximized();
        }
    }, function renderStatusBar() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const showDesktopControls = (viewModel.isWindows || viewModel.isLinux) && !viewModel.isFullScreen;
        const control = (className, icon, handler, style = {}) => createElement("div", {
            staticClass: className, style, on: { click: handler }
        }, [createElement("span", { staticClass: "icon text-sm" }, [viewModel._v(icon)])]);
        return createElement("div", {
            staticClass: "main relative",
            style: { color: ["dark"].includes(viewModel.theme) ? "white" : "black" }
        }, [
            createElement("div", { staticClass: "empty" }, [
                createElement("div", { staticClass: "top" }, [
                    createElement("div", { staticClass: "left", style: { width: `${viewModel.percent}%` } }),
                    viewModel._v(" "), createElement("div", { staticClass: "right" })
                ]),
                viewModel._v(" "), createElement("div", { staticClass: "bottom" })
            ]),
            viewModel._v(" "),
            createElement("span", { staticClass: "fixed left-1/2 -translate-x-1/2 text-xs whitespace-pre" }, [viewModel._v(`\n    ${viewModel._s(viewModel.titleText)}\n  `)]),
            viewModel._v(" "),
            showDesktopControls ? control("clickable close hover:bg-[color:var(--status-close-hover)]", "push_pin", viewModel.pinApp, { color: viewModel.isPinned ? "#0C7D9D" : "" }) : viewModel._e(),
            viewModel._v(" "),
            showDesktopControls ? control("clickable close hover:bg-[color:var(--status-close-hover)]", "minimize", viewModel.miniApp) : viewModel._e(),
            viewModel._v(" "),
            viewModel.isWindows || viewModel.isLinux ? control("clickable close hover:bg-[color:var(--status-close-hover)]", viewModel.isWinMax || viewModel.isFullScreen ? "close_fullscreen" : "check_box_outline_blank", viewModel.maxApp) : viewModel._e(),
            viewModel._v(" "),
            showDesktopControls ? control("clickable close hover:bg-[#ff5050d7]", "close", viewModel.closeApp) : viewModel._e()
        ]);
    }, "65878d23");

    return { ClashTrafficView, RunTimeView, MainMenu, StatusBar };
}

module.exports = { createHomePageComponents };
