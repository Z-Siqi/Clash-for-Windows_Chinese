"use strict";

function createLogsPage({
    defineComponent,
    Vuex,
    getLanguage,
    moment,
    flattenValues,
    notify,
    uniqueId,
    connectedStatus,
    clipboard,
    readLastLines,
    cache,
    keys,
    SelectView,
    normalizeStructuredLog,
    parseCoreLogLine
}) {
    return defineComponent({
        components: { SelectView },
        data() {
            return {
                listData: [],
                randomColor: [],
                client: null,
                isAutoScroll: true,
                dnsRecords: {},
                logLevel: parseInt(cache.get(keys.LOG_MOUDLE_LEVEL)) || 0,
                logTypeEmoji: { info: "✅", debug: "🪲", warn: "‼️", error: "❌" },
                searchText: "",
                showDetailItemIDs: [],
                logStyle: parseInt(cache.get(keys.LOG_MODULE_STYLE)) || 0
            };
        },
        watch: {
            searchText(value) { cache.put(keys.LOG_MODULE_SEARCH_TEXT, value); },
            isWindowShow(value) { this.handleWindowEvent(value); },
            clashStatus(value) {
                this.closeLogStream();
                if (value === connectedStatus) this.openLogStream();
            },
            logStyle(value) { cache.put(keys.LOG_MODULE_STYLE, value); },
            logLevel(value) {
                this.closeLogStream();
                this.openLogStream();
                cache.put(keys.LOG_MOUDLE_LEVEL, value);
            }
        },
        computed: {
            ...Vuex.mapState({
                isWindowShow: state => state.app.isWindowShow,
                clashStatus: state => state.app.clashStatus,
                mode: state => state.app.mode,
                logFilePath: state => state.app.logFilePath,
                settings: state => state.app.settings
            }),
            ...Vuex.mapGetters(["clashWSClient"]),
            logList() {
                return this.searchText && this.searchTextReg
                    ? this.listData.filter(item => this.searchTextReg.test(flattenValues(item))).slice(-200)
                    : this.listData.slice(-200);
            },
            searchTextReg() {
                try { return new RegExp(this.searchText, "i"); } catch (_error) { return null; }
            },
            buttonText() {
                return this.client?.readyState === 1 ? getLanguage().pause() : getLanguage().start();
            },
            buttonStyle() {
                return ["button", this.client?.readyState === 1 ? "button-off" : "button-on"];
            }
        },
        filters: {
            msgFilter(value) {
                const match = /(TCP|UDP)/.exec(value);
                return match ? match[1].trim().toUpperCase() : value;
            }
        },
        methods: {
            ...Vuex.mapActions(["getMode"]),
            isShowDetails(item) {
                return this.logStyle === 1 || this.searchText !== "" || this.showDetailItemIDs.includes(item.id);
            },
            addrFieldStr(item) {
                const field = (item?.fields || []).find(value => value.key === "rAddr");
                return field ? `${field.value}` : "";
            },
            copyPayload(item) {
                const field = item.fields.find(value => value.key === "rAddr");
                if (field) {
                    clipboard.writeText(field.value);
                    notify("Copied to Clipboad!", field.value);
                }
            },
            logItemClasses(item) {
                const dark = ["dark", "2077"].includes(this.theme);
                return {
                    debugdark: item.type === "debug" && !dark,
                    debug: item.type === "debug" && dark,
                    info: item.type === "info",
                    warn: item.type === "warn",
                    error: item.type === "error"
                };
            },
            randomBGC(type) {
                if (this.theme !== "light") return undefined;
                const existing = this.randomColor.find(value => value.type === type);
                if (existing) return { color: `rgb(${existing.r},${existing.g},${existing.b})` };
                const color = {
                    type,
                    r: Math.floor(150 * Math.random() + 10),
                    g: Math.floor(150 * Math.random() + 10),
                    b: Math.floor(150 * Math.random() + 10)
                };
                this.randomColor.push(color);
                return { color: `rgb(${color.r},${color.g},${color.b})` };
            },
            parseLog(log) {
                const { level, message, time, fields = [] } = log;
                this.listData = [...this.listData, {
                    type: level,
                    msg: message,
                    time: time || moment().format("HH:mm:ss"),
                    fields: fields.filter(field => field.key !== "mode" && field.value !== this.mode),
                    id: uniqueId()
                }];
            },
            openLogStream() {
                const client = this.clashWSClient("logs", [
                    `level=${["info", "debug"][this.logLevel]}`,
                    "format=structured"
                ]);
                if (!client) return;
                client.on("message", payload => {
                    try { this.parseLog(normalizeStructuredLog(JSON.parse(payload))); }
                    catch (_error) { console.error("failed to parse log"); }
                });
                this.client = client;
            },
            closeLogStream() {
                if (this.client) this.client.terminate();
                this.client = null;
            },
            handleItemClick(item) {
                const index = this.showDetailItemIDs.indexOf(item.id);
                if (index > -1) this.showDetailItemIDs.splice(index, 1);
                else this.showDetailItemIDs.push(item.id);
            },
            handleItemRightClick(event, item) {
                this.isAutoScroll = false;
                const remoteAddress = item.fields.find(field => field.key === "rAddr");
                this.$menu([{
                    text: remoteAddress?.value || "Unknown", disabled: true, icon: "title"
                }, {
                    text: getLanguage().copy(), icon: "content_copy", click: () => this.copyPayload(item)
                }], event);
            },
            handleBtnClick() { this.client ? this.closeLogStream() : this.openLogStream(); },
            handleClear() { this.listData = []; },
            handleWindowEvent(visible) { visible ? this.openLogStream() : this.closeLogStream(); },
            handleScroll(event) {
                const target = event.target;
                if (target) this.isAutoScroll = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 1;
            },
            parseStringLog(log) {
                const { payload, type, time } = log;
                const messageMatch = /^([^=]+)( .+=|$)/.exec(payload);
                const fields = [...payload.matchAll(/([^\s]+?)=([^=]+)(?= .+=|$)/g)]
                    .reduce((result, match) => {
                        const [, key, value] = match;
                        if (key === "mode" && value === this.mode) return result;
                        return [...result, { key: key.trim(), value: value.trim().replace(/^"|"$/g, "") }];
                    }, []);
                return {
                    msg: messageMatch ? messageMatch[1].trim() : "",
                    id: uniqueId(), type, fields,
                    time: time || moment().format("HH:mm:ss")
                };
            }
        },
        beforeRouteEnter(_to, _from, next) {
            next(async vm => {
                vm.searchText = cache.get(keys.LOG_MODULE_SEARCH_TEXT) || "";
                const configuredCount = vm.settings.logPreloadLineCount;
                const lineCount = configuredCount >= 0 ? configuredCount : 30;
                if (lineCount > 0) {
                    try {
                        const contents = await readLastLines.read(vm.logFilePath, lineCount);
                        contents.split("\n").forEach(line => {
                            const log = parseCoreLogLine(line);
                            if (log) vm.parseLog(log);
                        });
                    } catch (_error) {}
                }
                vm.getMode();
                vm.openLogStream();
                vm.$refs.list.addEventListener("scroll", vm.handleScroll);
            });
        },
        beforeRouteLeave(_to, _from, next) {
            this.closeLogStream();
            this.$refs.list.removeEventListener("scroll", this.handleScroll);
            next();
        },
        updated() {
            this.$nextTick(() => {
                const list = this.$refs.list;
                if (list && this.isAutoScroll) list.scrollTop = list.scrollHeight;
            });
        }
    }, function renderLogsPage() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const modeLabels = {
            global: labels.global(),
            rule: labels.rule(),
            direct: labels.direct(),
            script: labels.script()
        };
        const selectedModeLabel = modeLabels[String(viewModel.mode)] || String(viewModel.mode);

        const renderLogField = field => [
            field.key === "rAddr" ? viewModel._e() : createElement("div", {
                key: field.key,
                staticClass: "flex gap-x-[2px] items-baseline w-fit"
            }, [
                createElement("div", {
                    staticClass: "text-xs items-baseline text-[color:var(--log-item-payload-c)] flex-shrink-0"
                }, [viewModel._v(`\n                ${viewModel._s(field.key === "lAddr" ? "FROM" : field.key.toUpperCase())}\n              `)]),
                viewModel._v(" "),
                createElement("span", [viewModel._v("⇢")]),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "break-all max-w-full opacity-80"
                }, [viewModel._v(`\n                ${viewModel._s(field.value)}\n              `)])
            ])
        ];

        const renderLogItem = item => createElement("div", {
            key: item.id,
            staticClass: "clickable log-item w-full",
            on: {
                click: () => viewModel.handleItemClick(item),
                contextmenu: event => viewModel.handleItemRightClick(event, item)
            }
        }, [createElement("div", { staticClass: "text-sm w-full" }, [
            createElement("div", { staticClass: "flex justify-between" }, [
                createElement("div", {
                    staticClass: "text-xs",
                    class: viewModel.logItemClasses(item)
                }, [viewModel._v(`\n            ${viewModel._s(viewModel.logTypeEmoji[item.type])}\n            ${viewModel._s(item.msg)}\n          `)]),
                viewModel._v(" "),
                createElement("div", { staticClass: "text-xs opacity-60" }, [viewModel._v(viewModel._s(item.time))])
            ]),
            viewModel._v(" "),
            viewModel.addrFieldStr(item) ? createElement("div", {
                staticClass: "text-[14px] flex items-center gap-x-1"
            }, [
                createElement("span", {
                    staticClass: "opacity-40 text-[10px] rotate-90 inline-block transition-all duration-200 ease-in-out",
                    style: { transform: viewModel.isShowDetails(item) ? "rotate(180deg)" : "" }
                }, [viewModel._v("▲")]),
                viewModel._v(`\n          ${viewModel._s(viewModel.addrFieldStr(item))}\n        `)
            ]) : viewModel._e(),
            viewModel._v(" "),
            viewModel.isShowDetails(item) ? createElement("div", {
                staticClass: "flex text-xs flex-wrap gap-x-3"
            }, [viewModel._l(item.fields, renderLogField)], 2) : viewModel._e()
        ])]);

        return createElement("div", { staticClass: "main-log-view w-full" }, [
            createElement("div", { staticClass: "title" }, [
                createElement("div", { staticClass: "text flex-shrink-0" }, [
                    createElement("div", [viewModel._v(labels.requestLogs())]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "hint" }, [viewModel._v(labels.chains() + selectedModeLabel)])
                ]),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "relative w-full mx-4",
                    attrs: { title: viewModel.searchTextReg }
                }, [
                    createElement("input", {
                        directives: [{ name: "model", rawName: "v-model", value: viewModel.searchText, expression: "searchText" }],
                        ref: "search-text-input",
                        staticClass: "outline-none text-base w-full h-[35px] pl-3 pr-6",
                        attrs: { type: labels.text(), placeholder: labels.search() },
                        domProps: { value: viewModel.searchText },
                        on: {
                            input: event => {
                                if (!event.target.composing) viewModel.searchText = event.target.value;
                            }
                        }
                    }),
                    viewModel._v(" "),
                    viewModel.searchText ? createElement("span", {
                        staticClass: "icon text-sm absolute right-2 h-full flex top-0 items-center clickable",
                        on: {
                            click: () => {
                                viewModel.searchText = "";
                                viewModel.$refs["search-text-input"].focus();
                            }
                        }
                    }, [viewModel._v("close")]) : viewModel._e()
                ]),
                viewModel._v(" "),
                createElement("div", { staticClass: "btns" }, [
                    createElement("div", { staticClass: "flex gap-y-1 flex-col text-base" }, [
                        createElement("SelectView", {
                            staticClass: "mr-4",
                            attrs: { items: labels.simpleAndDetailed() },
                            model: {
                                value: viewModel.logStyle,
                                callback: value => { viewModel.logStyle = value; },
                                expression: "logStyle"
                            }
                        }),
                        viewModel._v(" "),
                        createElement("SelectView", {
                            staticClass: "mr-4",
                            attrs: { items: labels.infoAndDebug() },
                            model: {
                                value: viewModel.logLevel,
                                callback: value => { viewModel.logLevel = value; },
                                expression: "logLevel"
                            }
                        })
                    ], 1),
                    viewModel._v(" "),
                    createElement("div", {
                        staticClass: "button button-clear mr-2",
                        on: { click: viewModel.handleClear }
                    }, [viewModel._v(labels.clear())]),
                    viewModel._v(" "),
                    createElement("div", {
                        class: viewModel.buttonStyle,
                        on: { click: viewModel.handleBtnClick }
                    }, [viewModel._v(viewModel._s(viewModel.buttonText))])
                ])
            ]),
            viewModel._v(" "),
            createElement("div", { ref: "list", staticClass: "log-list w-full" }, [
                viewModel.listData.length === 0 ? createElement("div", { staticClass: "empty-list" }, [
                    createElement("div", [viewModel._v(labels.emptyLogList())]),
                    viewModel._v(" "),
                    createElement("div", [viewModel._v(labels.refreshBrowserMakeRequest())])
                ]) : viewModel._e(),
                viewModel._v(" "),
                viewModel._l(viewModel.logList, renderLogItem)
            ], 2)
        ]);
    }, "6acd51f2");
}

module.exports = { createLogsPage };
