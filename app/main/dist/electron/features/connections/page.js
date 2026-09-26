"use strict";

function createConnectionsPage({
    defineComponent,
    Hint,
    cache,
    keys,
    moment,
    Vuex,
    connectedStatus,
    path,
    EscCapture,
    formatBytes,
    flattenValues,
    notify,
    clipboard,
    getLanguage,
    getLanguageIndex,
    normalizeConnectionsSnapshot
}) {
    const ConnectionInfoView = defineComponent({
        name: "ConnectionInfoView",
        props: ["connection"],
        components: { EscCapture },
        data() {
            return { data: { speedStr: "" }, speedStr: "" };
        },
        watch: {
            infoData: {
                immediate: true,
                handler(value) {
                    if (Object.keys(value).length) this.data = value;
                }
            },
            connection: {
                immediate: true,
                handler(connection, previousConnection) {
                    if (!connection || !previousConnection) {
                        this.speedStr = "";
                        return;
                    }
                    this.speedStr = this.$parent.calcSpeedText({
                        speed: {
                            upload: connection.upload - previousConnection.upload,
                            download: connection.download - previousConnection.download
                        }
                    });
                }
            }
        },
        computed: {
            ...Vuex.mapGetters(["theme"]),
            isConnectionClosed() {
                return Object.keys(this.infoData).length === 0;
            },
            infoData() {
                const connection = this.connection;
                if (!connection) return {};

                const metadata = connection.metadata;
                const isDirect = connection.chains[0] === "DIRECT";
                const destination = `${isDirect ? metadata.destinationIP : metadata.host || metadata.destinationIP}:${metadata.destinationPort}`;
                const flow = `↑${formatBytes(connection.upload)} ↓${formatBytes(connection.download)}`;
                const source = `${metadata.sourceIP}:${metadata.sourcePort} (${metadata.type})`;
                const rule = `${connection.rule} (${connection.rulePayload})`;
                const mode = connection.chains.slice().reverse().join(" - ");
                const startedAt = moment(connection.start).format("MM-DD HH:mm:ss");

                if (getLanguageIndex() === 0) {
                    return {
                        主机: metadata.host,
                        网络: metadata.network.toUpperCase(),
                        流量: flow,
                        来源: source,
                        目的地: destination,
                        规则: rule,
                        "进程路径": metadata.processPath,
                        模式: mode,
                        "DNS 模式": metadata.dnsMode,
                        "开始时间": startedAt
                    };
                }
                return {
                    Host: metadata.host,
                    Network: metadata.network.toUpperCase(),
                    Flow: flow,
                    Source: source,
                    Destination: destination,
                    Rule: rule,
                    "Process Path": metadata.processPath,
                    Mode: mode,
                    "DNS Mode": metadata.dnsMode,
                    "Start Time": startedAt
                };
            }
        },
        methods: {
            handleCopyVal(value) {
                clipboard.writeText(value);
                notify("Copied to Clipboard!", value, true);
            }
        }
    }, function renderConnectionInfo() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const renderInfoRow = (key, index) => createElement("div", {
            key: index,
            staticClass: "content-item pl-4 pr-4 pt-2 pb-2"
        }, [
            createElement("div", { staticClass: "item-key" }, [viewModel._v(viewModel._s(key))]),
            viewModel._v(" "),
            viewModel.data[key] ? createElement("div", {
                staticClass: "item-value flex flex-wrap gap-2 opacity-80 font-normal items-center"
            }, [
                viewModel._v(`\n            ${viewModel._s(viewModel.data[key])}\n            `),
                createElement("div", {
                    staticClass: "bg-[color:#64646480] text-white rounded-lg px-2 py-[2px] text-xs h-fit",
                    on: { click() { return viewModel.handleCopyVal(viewModel.data[key]); } }
                }, [viewModel._v(`\n              ${labels.copy()}\n            `)])
            ]) : createElement("div", [viewModel._v("--")])
        ]);

        return createElement("EscCapture", {
            staticClass: "main bg-[color:var(--mask-c)]",
            class: [`theme-${viewModel.theme}`],
            on: {
                mousedown() { return viewModel.$emit("close"); },
                esc() { return viewModel.$emit("close"); }
            }
        }, [createElement("div", {
            staticClass: "card-main bg-[color:var(--bgc)] text-[color:var(--fgc)]",
            on: { mousedown(event) { event.stopPropagation(); } }
        }, [createElement("div", { staticClass: "card-content" }, [
            createElement("div", {
                staticClass: "content-title px-4 flex justify-between items-baseline gap-3"
            }, [
                createElement("span", [viewModel._v(labels.connectInfo())]),
                viewModel._v(" "),
                createElement("div", { staticClass: "flex-grow" }),
                viewModel._v(" "),
                viewModel.speedStr ? createElement("div", { staticClass: "text-xs" }, [viewModel._v(viewModel._s(viewModel.speedStr))]) : viewModel._e(),
                viewModel._v(" "),
                createElement("div", [viewModel.isConnectionClosed
                    ? createElement("span", { staticClass: "text-sm text-[#D44545]" }, [viewModel._v(labels.close())])
                    : createElement("span", { staticClass: "text-sm text-[#13AF42]" }, [viewModel._v(labels.alive())])])
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "w-full h-[1px] bg-gray-300" }),
            viewModel._v(" "),
            createElement("div", { staticClass: "content-list" }, viewModel._l(Object.keys(viewModel.data), renderInfoRow), 0)
        ])])]);
    }, "947c6bac");

    const ConnectionsPage = defineComponent({
        components: { Hint, ConnectionInfoView, EscCapture },
        data() {
            const labels = getLanguage();
            return {
                isPause: false,
                searchText: "",
                client: null,
                lastData: { uploadTotal: 0, downloadTotal: 0, connections: [] },
                data: { uploadTotal: 0, downloadTotal: 0, connections: [] },
                labelSelected: 4,
                reverseTags: [],
                detailConnectionId: "",
                filterTypes: [
                    { title: labels.sourceIP(), key: "sourceIP" },
                    { title: labels.destinationIP(), key: "destinationIP" },
                    { title: labels.domain(), key: "host" },
                    { title: labels.processPath(), key: "processPath" },
                    { title: labels.network(), key: "network" },
                    { title: labels.type(), key: "type" },
                    { title: labels.sourcePort(), key: "sourcePort" },
                    { title: labels.destinationPort(), key: "destinationPort" },
                    { title: labels.modeDNS(), key: "dnsMode" }
                ],
                filterTypeIndex: 0,
                isShowTypeFilter: false
            };
        },
        watch: {
            searchText(value) {
                cache.put(keys.CONNECTION_MODULE_SEARCH_TEXT, value);
            },
            clashStatus(value) {
                if (this.client) this.client.terminate();
                if (value === connectedStatus) this.setupComponent();
            }
        },
        computed: {
            ...Vuex.mapState({ clashStatus: state => state.app.clashStatus }),
            ...Vuex.mapGetters(["clashAxiosClient", "clashWSClient"]),
            detailConnection() {
                return this.detailConnectionId
                    ? this.data.connections.find(connection => connection.id === this.detailConnectionId) || null
                    : null;
            },
            searchTextReg() {
                try {
                    return new RegExp(this.searchText, "i");
                } catch (_error) {
                    return null;
                }
            },
            orderedConnections() {
                if (!this.data) return [];
                const timestamp = value => new Date(value).getTime();
                const connections = [...this.data.connections].map(connection => {
                    const previous = this.lastData.connections.find(item => item.id === connection.id);
                    connection.speed = previous ? {
                        upload: connection.upload - previous.upload,
                        download: connection.download - previous.download
                    } : { upload: 0, download: 0 };
                    return connection;
                }).sort((left, right) => {
                    if (this.labelSelected === 4) return timestamp(left.start) - timestamp(right.start);
                    if (this.labelSelected === 3) return right.download - left.download;
                    if (this.labelSelected === 2) return right.upload - left.upload;
                    if (this.labelSelected === 1) return right.speed.download - left.speed.download;
                    if (this.labelSelected === 0) return right.speed.upload - left.speed.upload;
                    if (this.labelSelected === 5) {
                        const rightDestination = right.metadata.host || right.metadata.destinationIP || "";
                        const leftDestination = left.metadata.host || left.metadata.destinationIP || "";
                        return rightDestination.localeCompare(leftDestination);
                    }
                    return 0;
                });
                const ordered = this.reverseTags?.[this.labelSelected] ? connections.reverse() : connections;
                if (this.searchText === "") return ordered;
                return ordered.filter(connection => {
                    const exactFilter = /^(.+?)\=(.+)$/.exec(this.searchText);
                    if (exactFilter) {
                        const [, field, expected] = exactFilter;
                        return connection?.metadata?.[field] === expected;
                    }
                    return !this.searchTextReg || this.searchTextReg.test(flattenValues(connection));
                });
            },
            connTypeLabels() {
                const field = this.filterTypes[this.filterTypeIndex].key;
                return [...new Set(this.data.connections.map(connection => connection?.metadata?.[field]))]
                    .filter(Boolean)
                    .sort();
            }
        },
        methods: {
            itemStyle(index) {
                const classes = [];
                if (this.filterTypeIndex === index) classes.push("selected");
                if (this.filterTypeIndex !== index) classes.push("item-none");
                if (this.filterTypeIndex === index + 1) classes.push("selected-top");
                if (this.filterTypeIndex === index - 1) classes.push("selected-bottom");
                return classes;
            },
            connectionEndpoint(connection) {
                const chains = connection.chains || [];
                const chainType = this.settings.connChainType ?? 0;
                return [0, 2].includes(chainType) && chains.length >= 1 ? chains[0] : "";
            },
            connectionProcess(connection) {
                const processPath = connection.metadata?.processPath || "";
                try {
                    return processPath ? path.basename(processPath) : "";
                } catch (_error) {
                    return "";
                }
            },
            connectionGroup(connection) {
                const chains = connection.chains || [];
                const chainType = this.settings.connChainType ?? 0;
                if (chainType === 2 && chains.length === 1) return "";
                return [1, 2].includes(chainType) && chains.length >= 1 ? chains[chains.length - 1] : "";
            },
            handleLabelSelect(index) {
                if (this.labelSelected === index) this.reverseTags[index] = !this.reverseTags?.[index];
                else this.labelSelected = index;
                cache.put(keys.CONNECTION_ORDER_INDEX, index);
                cache.put(keys.CONNECTION_ORDER_REVERSE_TAGS, this.reverseTags);
            },
            calcLabelClasses(index) {
                const classes = ["label"];
                if (this.labelSelected === index) {
                    classes.push(this.reverseTags[index] ? "label-selected-reverse" : "label-selected");
                }
                return classes;
            },
            calcSpeedText(connection) {
                if (!connection.speed) return "";
                const output = [];
                const { upload = 0, download = 0 } = connection.speed;
                if (upload !== 0) output.push(`↑${this.traffic(upload)}/s`);
                if (download !== 0) output.push(`↓${this.traffic(download)}/s`);
                return output.join(" ");
            },
            fromNow(value) {
                return moment(value).locale(getLanguage().locale()).fromNow();
            },
            traffic(value, precision = 2) {
                const units = ["B", "KB", "MB", "GB", "TB"];
                let unitIndex = 0;
                while (Math.trunc(value / 1024) && unitIndex < units.length - 1) {
                    value /= 1024;
                    unitIndex++;
                }
                return `${unitIndex === 0 ? value : value.toFixed(precision)} ${units[unitIndex]}`;
            },
            upperCaseFirst(value) {
                return value.charAt(0).toUpperCase() + value.slice(1);
            },
            async handleCloseConnection(connectionId) {
                await this.clashApi.closeConnection(connectionId);
            },
            async handleCloseAllConnections() {
                await Promise.allSettled(this.orderedConnections.map(connection => this.clashApi.closeConnection(connection.id)));
            },
            handleItemSelected(connection) {
                this.detailConnectionId = connection.id;
            },
            handleSwitchPauseStatus() {
                this.isPause = !this.isPause;
                if (this.isPause) this.closeStream();
                else this.openStream();
            },
            closeStream() {
                if (this.client) this.client.terminate();
                this.client = null;
            },
            openStream() {
                const client = this.clashWSClient("connections");
                if (!client) return;
                client.on("message", payload => {
                    const snapshot = normalizeConnectionsSnapshot(JSON.parse(payload));
                    this.lastData = this.data;
                    this.data = snapshot;
                });
                this.client = client;
            },
            setupComponent() {
                this.labelSelected = cache.get(keys.CONNECTION_ORDER_INDEX) ?? 4;
                this.reverseTags = cache.get(keys.CONNECTION_ORDER_REVERSE_TAGS) ?? [];
                if (!this.isPause) this.openStream();
            }
        },
        beforeRouteEnter(route, _previousRoute, next) {
            next(viewModel => {
                viewModel.setupComponent();
                const searchText = route.query.searchText || "";
                viewModel.searchText = searchText
                    ? searchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
                    : cache.get(keys.CONNECTION_MODULE_SEARCH_TEXT) ?? "";
            });
        },
        beforeRouteLeave(_route, _previousRoute, next) {
            this.closeStream();
            next();
        }
    }, function renderConnectionsPage() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const renderSortControl = (index, hint, icons) => createElement("Hint", {
            class: viewModel.calcLabelClasses(index),
            attrs: { hint },
            on: { click() { return viewModel.handleLabelSelect(index); } }
        }, [createElement("div", { staticClass: "flex gap-1" }, icons.map(icon => createElement("span", {
            staticClass: "icon"
        }, [viewModel._v(icon)])))]);
        const renderConnection = connection => createElement("div", {
            key: connection.id,
            class: ["conn-item", connection.closed ? "conn-item-closed" : ""],
            on: { click() { return viewModel.handleItemSelected(connection); } }
        }, [
            createElement("div", [
                createElement("div", { staticClass: "conn-item-top" }, [
                    createElement("div", { staticClass: "conn-host" }, [viewModel._v(`\n            ${viewModel._s(connection.metadata.host || connection.metadata.destinationIP)}:${viewModel._s(connection.metadata.destinationPort)}\n          `)])
                ]),
                viewModel._v(" "),
                createElement("div", { staticClass: "conn-labels" }, [
                    createElement("div", { staticClass: "conn1" }, [viewModel._v(`\n            ${viewModel._s(connection.metadata.network.toUpperCase())}\n          `)]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "conn2" }, [viewModel._v(viewModel._s(connection.metadata.type))]),
                    viewModel._v(" "),
                    viewModel.settings.connShowProcess && viewModel.connectionProcess(connection) ? createElement("div", { staticClass: "conn7" }, [viewModel._v(`\n            ${viewModel._s(viewModel.connectionProcess(connection))}\n          `)]) : viewModel._e(),
                    viewModel._v(" "),
                    viewModel.connectionGroup(connection) ? createElement("div", { staticClass: "conn3" }, [viewModel._v(`\n            ${viewModel._s(viewModel.connectionGroup(connection))}\n          `)]) : viewModel._e(),
                    viewModel._v(" "),
                    viewModel.connectionEndpoint(connection) ? createElement("div", { staticClass: "conn4" }, [viewModel._v(`\n            ${viewModel._s(viewModel.connectionEndpoint(connection))}\n          `)]) : viewModel._e(),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "conn5" }, [viewModel._v(`\n            ${viewModel._s(viewModel.upperCaseFirst(viewModel.fromNow(connection.start)))}\n          `)]),
                    viewModel._v(" "),
                    connection.speed.upload || connection.speed.download ? createElement("div", { staticClass: "conn6" }, [viewModel._v(`\n            ${viewModel._s(viewModel.calcSpeedText(connection))}\n          `)]) : viewModel._e()
                ])
            ]),
            viewModel._v(" "),
            connection.closed || viewModel.isPause ? viewModel._e() : createElement("div", {
                staticClass: "close-btn",
                on: { click(event) { event.stopPropagation(); return viewModel.handleCloseConnection(connection.id); } }
            }, [createElement("span", { staticClass: "icon text flex justify-center items-center w-full h-full" }, [viewModel._v("block")])])
        ]);

        return createElement("div", {
            staticClass: "main-connection-view relative",
            on: { click() { viewModel.isShowTypeFilter = false; } }
        }, [
            createElement("EscCapture", {
                directives: [{ name: "show", rawName: "v-show", value: viewModel.isShowTypeFilter, expression: "isShowTypeFilter" }],
                staticClass: "translate-y-[2px] flex min-w-[500px] w-[calc(100%-200px)] h-[calc(100%-300px)] min-h-[400px] absolute rounded overflow-hidden z-10 shadow-lg text-sm border border-[color:var(--bc)] left-1/2 -translate-x-1/2 top-[32px]",
                on: {
                    click(event) { event.stopPropagation(); },
                    esc() { viewModel.isShowTypeFilter = false; }
                }
            }, [
                createElement("div", { staticClass: "bg-[color:var(--bgc)] w-fit flex flex-col flex-shrink-0 items-center" }, [
                    ...viewModel.filterTypes.map((filterType, index) => createElement("div", {
                        key: filterType.key,
                        staticClass: "h-[40px] px-3 flex items-center justify-center w-full clickable",
                        class: viewModel.itemStyle(index),
                        on: { click() { viewModel.filterTypeIndex = index; } }
                    }, [viewModel._v(`\n        ${viewModel._s(filterType.title)}\n      `)])),
                    createElement("div", {
                        staticClass: "flex-grow bg-[color:var(--mbgc)] w-full",
                        class: viewModel.itemStyle(viewModel.filterTypes.length)
                    })
                ]),
                viewModel._v(" "),
                createElement("div", { staticClass: "bg-[color:var(--bgc)] flex-1 flex flex-col overflow-y-auto scrolly" }, viewModel.connTypeLabels.map(value => createElement("div", {
                    key: value,
                    staticClass: "hover:bg-[color:var(--proxy-item-bgc)] h-fit flex items-center break-all py-1 font-normal px-2 clickable gap-x-1",
                    on: { click() {
                        viewModel.searchText = `${viewModel.filterTypes[viewModel.filterTypeIndex].key}=${value}`;
                        viewModel.isShowTypeFilter = false;
                    } }
                }, [
                    createElement("div", { staticClass: "icon text-sm" }, [viewModel._v("search")]),
                    viewModel._v(" "),
                    createElement("div", [viewModel._v(viewModel._s(value))])
                ])))
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "header relative" }, [
                createElement("div", { staticClass: "title" }, [createElement("div", [viewModel._v(labels.connections())])]),
                viewModel._v(" "),
                createElement("div", { staticClass: "search-area relative" }, [
                    createElement("input", {
                        directives: [{ name: "model", rawName: "v-model", value: viewModel.searchText, expression: "searchText" }],
                        ref: "search-text-input",
                        staticClass: "search-box",
                        attrs: { type: labels.text(), placeholder: labels.search() },
                        domProps: { value: viewModel.searchText },
                        on: {
                            click(event) { event.stopPropagation(); viewModel.isShowTypeFilter = true; viewModel.$refs["search-text-input"].focus(); },
                            change() { viewModel.isShowTypeFilter = false; },
                            input(event) { if (!event.target.composing) viewModel.searchText = event.target.value; }
                        }
                    }),
                    viewModel._v(" "),
                    viewModel.searchText ? createElement("span", {
                        staticClass: "icon text-sm absolute right-2 h-full flex top-0 items-center clickable",
                        on: { click(event) {
                            event.stopPropagation();
                            viewModel.searchText = "";
                            viewModel.$refs["search-text-input"].focus();
                            viewModel.isShowTypeFilter = true;
                        } }
                    }, [viewModel._v("close")]) : viewModel._e()
                ]),
                viewModel._v(" "),
                createElement("div", { staticClass: "header-right" }, [createElement("div", { staticClass: "total-hint" }, [
                    viewModel._v(`\n        ${viewModel._s(`${labels.total()}: ↑${viewModel.traffic(viewModel.data.uploadTotal, 1)} ↓${viewModel.traffic(viewModel.data.downloadTotal, 1)}`)}\n      `)
                ])])
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "control-view border-b border-b-[color:var(--bc)]" }, [
                createElement("div", { staticClass: "labels overflow-clip justify-between w-full" }, [
                    renderSortControl(0, labels.uploadSpeed(), ["upload", "speed"]),
                    viewModel._v(" "),
                    renderSortControl(1, labels.downloadSpeed(), ["download", "speed"]),
                    viewModel._v(" "),
                    renderSortControl(2, labels.uploadTraffic(), ["upload", "signal_cellular_alt"]),
                    viewModel._v(" "),
                    renderSortControl(3, labels.downloadTraffic(), ["download", "signal_cellular_alt"]),
                    viewModel._v(" "),
                    renderSortControl(4, labels.startTime(), ["schedule"]),
                    viewModel._v(" "),
                    renderSortControl(5, labels.destination(), ["computer"]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "flex-grow" }),
                    viewModel._v(" "),
                    createElement("div", {
                        class: ["close-all-btn", viewModel.isPause ? "button-resume" : "button-pause"],
                        on: { click: viewModel.handleSwitchPauseStatus }
                    }, [viewModel._v(`\n        ${viewModel._s(viewModel.isPause ? labels.resume() : labels.pause())}\n      `)]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "close-all-btn", on: { click: viewModel.handleCloseAllConnections } }, [
                        viewModel._v(`\n        ${labels.closeAll()}\n        `),
                        createElement("span", [viewModel._v(`(${viewModel._s(viewModel.orderedConnections.length)})`)])
                    ])
                ], 1)
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "scroll-view" }, viewModel._l(viewModel.orderedConnections, renderConnection), 0),
            viewModel._v(" "),
            viewModel.detailConnectionId ? createElement("ConnectionInfoView", {
                attrs: { connection: viewModel.detailConnection },
                on: { close() { viewModel.detailConnectionId = ""; } }
            }) : viewModel._e()
        ], 1);
    }, "39b270f2");

    return ConnectionsPage;
}

module.exports = { createConnectionsPage };
