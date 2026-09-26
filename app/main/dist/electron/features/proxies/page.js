"use strict";

const { supportsScriptMode } = require("../../core/clash-core/core-capabilities");

function createProxiesPage({
    defineComponent,
    Hint,
    Vuex,
    Navigator,
    CancelToken,
    cache,
    keys,
    lodash,
    runUserScript,
    cloneJson,
    proxyScriptType,
    connectedStatus,
    scheduler,
    getLanguage
}) {
    const ProxyModeSwitcher = defineComponent({
        components: { Hint },
        props: ["mode", "scriptModeVisible"],
        methods: {
            btnTheme(mode) {
                return ["btn", this.mode === mode.toLowerCase() ? "selected" : "normal"];
            },
            async switchMode(mode) {
                this.$parent.cancelLatencyTest();
                this.$emit("switch", mode);
            }
        }
    }, function renderProxyModeSwitcher() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const renderMode = (mode, title, hint, icon) => createElement("Hint", {
            staticClass: "gap-x-2 clickable",
            class: viewModel.btnTheme(mode),
            staticStyle: { "flex-direction": "row" },
            attrs: { position: "bottom", hint },
            on: { click() { return viewModel.switchMode(mode); } }
        }, [
            createElement("span", [viewModel._v(title)]),
            viewModel._v(" "),
            createElement("div", { staticClass: "icon rotate-90" }, [viewModel._v(icon)])
        ]);

        const buttons = [
            renderMode("global", labels.global(), labels.routedThroughSelectedProxy(), "merge"),
            viewModel._v(" "),
            renderMode("rule", labels.rule(), labels.routedAccordingRule(), "alt_route"),
            viewModel._v(" "),
            renderMode("direct", labels.direct(), labels.goDirectly(), "straight")
        ];
        if (viewModel.scriptModeVisible) {
            buttons.push(viewModel._v(" "));
            buttons.push(renderMode("script", labels.script(), labels.routedAccordingScript(), "alt_route"));
        }

        return createElement("div", {
            staticClass: "main",
            attrs: { id: "main-mode-switcher" }
        }, [createElement("div", {
            staticClass: "btns",
            class: { compact: !viewModel.scriptModeVisible }
        }, buttons, 1)]);
    }, "357c3e79");

    const ProxiesPage = defineComponent({
        components: { ProxyModeSwitcher, Navigator, Hint },
        data() {
            return {
                proxies: [],
                axiosCancelTokens: [],
                showSecIdxs: [],
                hideTimeoutSecNames: [],
                intervalID: null,
                filterKeyword: "",
                filterKeywordReg: /.*/,
                isShowFilter: false,
                isScrolling: false,
                topItemIndex: -1,
                topProxyIndex: -1,
                proxyBlinkIndex: -1,
                groupBlinkIndex: -1,
                testingProxyNames: []
            };
        },
        watch: {
            clashStatus(value) {
                if (value === connectedStatus) this.fetchData();
            },
            filterKeyword: {
                handler: lodash.debounce(function updateFilter(value) {
                    cache.put(keys.PROXY_FILTER_KEYWORD, value);
                    try {
                        this.filterKeywordReg = value ? new RegExp(value, "i") : /.*/;
                    } catch (_error) {
                        this.filterKeywordReg = /.*/;
                    }
                }, 500)
            },
            profileRefreshTimes() {
                this.fetchData();
            },
            proxyBlinkIndex() {
                setTimeout(() => { this.proxyBlinkIndex = -1; }, 300);
            },
            groupBlinkIndex() {
                setTimeout(() => { this.groupBlinkIndex = -1; }, 300);
            },
            hideTimeoutSecNames(value) {
                cache.put(keys.PROXY_HIDE_TIMEOUT_SEC_NAMES, value);
            }
        },
        computed: {
            ...Vuex.mapState({
                clashPath: state => state.app.clashPath,
                pfs: state => state.app.profiles,
                clashStatus: state => state.app.clashStatus,
                confData: state => state.app.confData,
                clashAxiosFlyingRequestCount: state => state.app.clashAxiosFlyingRequestCount,
                profileRefreshTimes: state => state.app.profileRefreshTimes,
                currentMode: state => state.app.mode,
                currentProfilePayload: state => state.app.currentProfilePayload,
                scriptModeVisible: state => supportsScriptMode(state.app.settings.proxyCore)
            }),
            ...Vuex.mapGetters(["clashAxiosClient"]),
            delayKeyName() {
                return ["delay", "meanDelay"][this.settings.proxyDelayType] || "delay";
            },
            navigatorWidth() {
                return this.settings.proxyMiniListWidth;
            },
            proxyItemWidth() {
                const width = this.settings.proxyItemWidth;
                return parseInt(width, 10) >= 150 ? `${width}px` : "290px";
            },
            errorIndexes() {
                return this.proxyInMode.reduce((indexes, group, index) => {
                    const selected = group.data.now
                        ? group.data.all.find(proxy => proxy.name === group.data.now)
                        : null;
                    if (selected && !selected.alive) indexes.push(index);
                    return indexes;
                }, []);
            },
            proxyInMode() {
                if (this.currentMode === "global") return this.proxies.filter(group => group.name === "GLOBAL");
                if (this.currentMode === "direct") return [];
                const visibleTypes = this.settings.hideUnselectableGroup
                    ? ["Selector"]
                    : ["Selector", "Fallback", "URLTest", "LoadBalance", "Relay"];
                return this.proxies.filter(group => group.name !== "GLOBAL" && visibleTypes.includes(group.data.type));
            },
            isShowNavigator() {
                return parseInt(this.settings.proxyMiniListWidth, 10) !== 0;
            }
        },
        methods: {
            ...Vuex.mapMutations({ changeProfile: "CHANGE_PROFILE" }),
            ...Vuex.mapActions(["getMode", "setMode"]),
            debounceScroll: lodash.debounce(function finishScrolling() {
                this.isScrolling = false;
            }, 1000),
            handleListScroll() {
                this.isScrolling = true;
                const scrollContainer = this.$refs["mixin-scroll-content"];
                const sections = this.$refs.list;
                this.topItemIndex = [...sections, { offsetTop: Infinity }]
                    .findIndex(section => section.offsetTop - 120 > scrollContainer.scrollTop) - 1;
                const activeSection = sections[this.topItemIndex];
                this.topProxyIndex = activeSection
                    ? [...activeSection.querySelectorAll(".proxy-item")]
                        .findIndex(proxy => proxy.offsetTop - 100 > scrollContainer.scrollTop)
                    : -1;
                this.debounceScroll();
            },
            async handleProxyRightClick(event, proxyName) {
                const groupIndex = this.proxyInMode.findIndex(group => group.name === proxyName);
                const menuItems = [{
                    text: getLanguage().showConnections(),
                    icon: "list",
                    click: () => {
                        this.$router.replace({
                            path: "/home/connection",
                            query: { searchText: proxyName }
                        }).catch(() => {});
                    }
                }, {
                    text: getLanguage().runScript(),
                    icon: "code",
                    click: () => {
                        const proxy = (this.currentProfilePayload.proxies || []).find(item => item.name === proxyName)
                            || { name: proxyName };
                        runUserScript(cloneJson(proxy), proxyScriptType);
                    }
                }];
                if (groupIndex > -1) {
                    menuItems.unshift({
                        text: getLanguage().scrollGroup(),
                        icon: "travel_explore",
                        click: () => this.handleNavigateToGroup(groupIndex)
                    });
                }
                this.$menu(menuItems, event);
            },
            handleFilterIconClick() {
                this.isShowFilter = !this.isShowFilter;
                if (!this.isShowFilter) this.filterKeyword = "";
                this.$nextTick(() => this.$refs.filterKeyword?.focus());
            },
            checkBtnText(proxy) {
                if (proxy.latency === -1) return "-- ms";
                return proxy.latency || getLanguage().check();
            },
            async handleSingleSpeedtest(group, proxy) {
                const groupName = group.name;
                const proxyName = proxy.name;
                const updateLatency = latency => {
                    const currentGroup = this.proxyInMode.find(item => item.name === groupName);
                    const currentProxy = currentGroup?.data.all.find(item => item.name === proxyName);
                    if (currentProxy) {
                        currentProxy.latency = latency === -1
                            ? -1
                            : latency + (/\d/.test(latency) ? " ms" : getLanguage().timeout());
                    }
                };

                this.cancelLatencyTest();
                this.testingProxyNames = [...this.testingProxyNames, proxyName];
                updateLatency(-1);
                let latency = "";
                try {
                    const { latencyTimeout, latencyUrl } = this.settings;
                    latency = await this.speedtest(
                        proxyName,
                        latencyTimeout || 3000,
                        latencyUrl || "https://www.gstatic.com/generate_204",
                        proxy.provider
                    );
                } catch (_error) {}
                this.testingProxyNames = this.testingProxyNames.filter(name => name !== proxyName);
                updateLatency(latency);
            },
            saveShowSecIdxs() {
                cache.put(keys.PROXY_SHOW_SEC_IDXS, this.showSecIdxs);
            },
            handleNavigateToGroup(index) {
                if (!this.showSecIdxs.includes(index)) this.showSecIdxs.push(index);
                this.groupBlinkIndex = index;
                const scrollContainer = this.$refs["mixin-scroll-content"];
                const sections = this.$refs.list;
                this.$nextTick(() => { scrollContainer.scrollTop = sections[index].offsetTop - 120; });
            },
            scrollToSelected(index) {
                this.proxyBlinkIndex = index;
                const selectedProxy = this.$refs[`selected${index}`][0];
                const scrollContainer = this.$refs["mixin-scroll-content"];
                const targetTop = selectedProxy.offsetTop - 160;
                if (targetTop < scrollContainer.scrollTop
                    || targetTop > scrollContainer.scrollTop + scrollContainer.clientHeight - 200) {
                    this.$nextTick(() => { scrollContainer.scrollTop = targetTop; });
                }
            },
            async switchHideTimeout(groupName) {
                if (this.hideTimeoutSecNames.includes(groupName)) {
                    this.hideTimeoutSecNames = this.hideTimeoutSecNames.filter(name => name !== groupName);
                } else {
                    this.hideTimeoutSecNames.push(groupName);
                }
            },
            async switchVisible(index) {
                const sections = this.$refs.list;
                const scrollContainer = this.$refs["mixin-scroll-content"];
                const section = sections[index]?.childNodes[0];
                const sectionHeader = section?.childNodes[0];
                const sectionItems = section?.childNodes[2];
                if (this.showSecIdxs.includes(index)) {
                    this.showSecIdxs = this.showSecIdxs.filter(value => value !== index);
                    this.$nextTick(() => {
                        if (sectionHeader.offsetTop > sectionItems.offsetTop) {
                            scrollContainer.scrollTop = section.offsetTop - 112;
                        }
                    });
                } else {
                    this.showSecIdxs.push(index);
                }
                this.saveShowSecIdxs();
            },
            nodeHint(proxy) {
                const group = this.proxies.find(item => item.name === proxy.name);
                if (!group) return "";
                const type = group.data.type;
                if (["Selector", "Fallback", "URLTest"].includes(type)) return `${type} - ${group.data.now}`;
                if (type === "LoadBalance") {
                    return `${type} - ${group.data.all.length} server${group.data.all.length > 1 ? "s" : ""}`;
                }
                return type;
            },
            cancelLatencyTest() {
                this.axiosCancelTokens.forEach(cancel => cancel());
                this.axiosCancelTokens = [];
            },
            async switchProxy(groupName, proxyName, isUnselectable = false) {
                if (isUnselectable) return;
                this.cancelLatencyTest();
                const response = await this.clashApi.selectProxy(groupName, proxyName);
                if (response.status !== 204) return;
                const proxies = [...this.proxies];
                const group = proxies.find(item => item.name === groupName);
                if (group) group.data.now = proxyName;
                this.proxies = proxies.length > 500 ? Object.freeze(proxies) : proxies;
                this.$parent.persistSelectedProxy();
                this.$parent.breakConnections(groupName);
            },
            async startLatencyTest(groupName, groupIndex) {
                this.cancelLatencyTest();
                if (!this.showSecIdxs.includes(groupIndex)) this.showSecIdxs.push(groupIndex);
                const group = this.proxies.find(item => item.name === groupName);
                const { latencyTimeout, latencyUrl } = this.settings;
                const proxies = group.data.all;
                const ordered = groupIndex === this.topItemIndex
                    ? [...proxies.slice(this.topProxyIndex), ...proxies.slice(0, this.topProxyIndex).reverse()]
                    : proxies;
                ordered.forEach(proxy => { proxy.latency = -1; });
                ordered.forEach(async proxy => {
                    try {
                        const latency = await this.speedtest(
                            proxy.name,
                            latencyTimeout || 3000,
                            latencyUrl || "https://www.gstatic.com/generate_204",
                            proxy.provider
                        );
                        proxy.latency = latency > 0 ? `${latency} ms` : getLanguage().timeout();
                    } catch (_error) {
                        proxy.latency = getLanguage().timeout();
                    }
                });
            },
            async speedtest(proxyName, timeout = 1000, url = "https://www.gstatic.com/generate_204", provider) {
                const response = await this.clashApi.testProxyDelay(proxyName, {
                    params: { timeout, url },
                    cancelToken: new CancelToken(cancel => { this.axiosCancelTokens.push(cancel); }),
                    timeout: 0
                }, provider);
                return response.data?.[this.delayKeyName] || 0;
            },
            async handleModeSwitch(mode) {
                try {
                    await this.setMode({ mode });
                } catch (_error) {}
            },
            findProvider(providers, proxyName) {
                for (const provider of Object.values(providers)) {
                    const proxy = (provider.proxies || []).find(item => item.name === proxyName);
                    if (proxy) return [provider, proxy];
                }
                return [null, {}];
            },
            async fetchData() {
                if (!this.clashApi.isReady()) return;
                const maximumDelay = Number.MAX_SAFE_INTEGER;
                const [proxyResponse, providerResponse] = await Promise.all([
                    this.clashApi.getProxies(),
                    this.clashApi.getProxyProviders({ validateStatus: () => true })
                ]);
                const providers = providerResponse.data?.providers || {};
                const proxyData = proxyResponse.data.proxies;
                const globalOrder = proxyData.GLOBAL?.all || Object.keys(proxyData);
                this.viewData = proxyData;

                const groups = Object.keys(proxyData).map(groupName => {
                    const group = proxyData[groupName];
                    if (!Object.prototype.hasOwnProperty.call(group, "all")) group.all = [group.now];
                    group.all = group.all.map(proxyName => {
                        const directProxy = proxyData[proxyName];
                        if (!directProxy) {
                            const [provider, providerProxy] = this.findProvider(providers, proxyName);
                            const history = providerProxy.history || [];
                            const delay = history.length ? history[history.length - 1][this.delayKeyName] : 0;
                            return {
                                name: proxyName,
                                provider,
                                latency: history.length ? (delay === 0 ? getLanguage().timeout() : `${delay} ms`) : "",
                                delay: delay || maximumDelay,
                                udp: providerProxy.udp || false,
                                alive: providerProxy.alive === undefined || providerProxy.alive
                            };
                        }
                        const history = directProxy.history || [];
                        const delay = history.length ? history[history.length - 1][this.delayKeyName] : 0;
                        return {
                            name: proxyName,
                            provider: null,
                            latency: this.testingProxyNames.includes(proxyName)
                                ? -1
                                : history.length ? (delay === 0 ? getLanguage().timeout() : `${delay} ms`) : null,
                            delay: delay || maximumDelay,
                            udp: directProxy.udp || false,
                            alive: directProxy.alive === undefined || directProxy.alive
                        };
                    }).sort((left, right) => {
                        const order = this.settings.proxyOrder ?? 0;
                        if (order === 1 && group.type !== "Fallback") return left.delay - right.delay;
                        if (order === 2) return left.name.localeCompare(right.name);
                        return 0;
                    });
                    return { name: groupName, data: group };
                }).sort((left, right) => globalOrder.indexOf(left.name) - globalOrder.indexOf(right.name));

                this.proxies = groups.length > 500 ? Object.freeze(groups) : groups;
            }
        },
        beforeRouteEnter(_route, _previousRoute, next) {
            next(async viewModel => {
                viewModel.getMode();
                viewModel.showSecIdxs = cache.get(keys.PROXY_SHOW_SEC_IDXS) || [];
                viewModel.hideTimeoutSecNames = cache.get(keys.PROXY_HIDE_TIMEOUT_SEC_NAMES) || [];
                viewModel.filterKeyword = cache.get(keys.PROXY_FILTER_KEYWORD) || "";
                viewModel.isShowFilter = viewModel.filterKeyword !== "";
                viewModel.intervalID = scheduler.add(async () => {
                    if (!viewModel.isScrolling && viewModel.clashAxiosFlyingRequestCount < 5) {
                        await Promise.allSettled([viewModel.getMode(), viewModel.fetchData()]);
                    }
                }, 5000);
                await viewModel.fetchData().catch(() => {});
            });
        },
        beforeRouteLeave(_route, _previousRoute, next) {
            if (this.intervalID) scheduler.stop(this.intervalID);
            this.cancelLatencyTest();
            next();
        }
    }, function renderProxiesPage() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const renderSectionAction = (hint, icon, handler, visible = true) => visible ? createElement("Hint", {
            staticClass: "sec-icon clickable",
            attrs: { hint, position: "top" },
            on: { click(event) { event.stopPropagation(); return handler(); } }
        }, [createElement("span", { staticClass: "icon" }, [viewModel._v(icon)])]) : viewModel._e();
        const renderProxy = (group, groupIndex, proxy, proxyIndex) => createElement("div", {
            directives: [{
                name: "show",
                rawName: "v-show",
                value: (!viewModel.hideTimeoutSecNames.includes(group.name) || labels.timeout() !== proxy.latency)
                    && viewModel.filterKeywordReg.test(proxy.name)
            }],
            key: proxy.name + group.name + proxyIndex,
            ref: proxy.name === group.data.now ? `selected${groupIndex}` : "",
            refInFor: true,
            staticClass: "proxy-item",
            class: {
                selected: proxy.name === group.data.now,
                clickable: group.data.type === "Selector",
                flick: proxy.name === group.data.now && groupIndex === viewModel.proxyBlinkIndex
            },
            style: [{ width: viewModel.proxyItemWidth }],
            on: {
                click() { return viewModel.switchProxy(group.name, proxy.name, group.data.type !== "Selector"); },
                contextmenu(event) { return viewModel.handleProxyRightClick(event, proxy.name); }
            }
        }, [
            createElement("div", { staticClass: "indicator" }),
            viewModel._v(" "),
            createElement("div", { staticClass: "info" }, [
                createElement("div", { staticClass: "left" }, [
                    createElement("div", { staticClass: "item-name", class: { offline: !proxy.alive } }, [viewModel._v(`\n                    ${viewModel._s(proxy.name)}\n                  `)]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "item-bottom" }, [
                        createElement("div", { staticClass: "item-hint" }, [viewModel._v(`\n                      ${viewModel._s(proxy.provider ? `Provider: ${proxy.provider.name}` : viewModel.nodeHint(proxy))}\n                    `)]),
                        viewModel._v(" "),
                        proxy.udp ? createElement("div", { staticClass: "item-udp" }, [viewModel._v("UDP")]) : viewModel._e()
                    ])
                ]),
                viewModel._v(" "),
                proxy.latency === -1 ? createElement("div", { staticClass: "time" }, [viewModel._v("- ms")]) : createElement("div", {
                    class: {
                        offline: labels.timeout() === proxy.latency,
                        online: ![labels.timeout(), -1, null, undefined, ""].includes(proxy.latency),
                        time: true
                    },
                    on: {
                        click: [() => viewModel.handleSingleSpeedtest(group, proxy), event => event.stopPropagation()]
                    }
                }, [viewModel._v(`\n                  ${viewModel._s(viewModel.checkBtnText(proxy))}\n                `)])
            ])
        ]);
        const renderGroup = (group, groupIndex) => createElement("div", {
            key: group.name,
            ref: "list",
            refInFor: true
        }, [createElement("div", { staticClass: "proxy-list" }, [
            createElement("div", {
                class: ["proxy-section", viewModel.groupBlinkIndex === groupIndex ? "flick" : ""],
                on: { click() { return viewModel.switchVisible(groupIndex); } }
            }, [
                createElement("div", { staticClass: "proxy-section-name" }, [
                    createElement("div", { staticClass: "proxy-section-name-left" }, [viewModel._v(viewModel._s(group.name))]),
                    viewModel._v(" "),
                    createElement("div", {
                        staticClass: "proxy-hint-type",
                        class: [group.data.type === "Selector" ? "proxy-hint-type-selector" : ""]
                    }, [viewModel._v(`\n              ${viewModel._s(group.data.type[0])}\n            `)]),
                    viewModel._v(" "),
                    group.data.now ? createElement("div", { staticClass: "proxy-hint-line" }) : viewModel._e(),
                    viewModel._v(" "),
                    group.data.now ? createElement("div", { staticClass: "proxy-hint" }, [viewModel._v(`\n              ${viewModel._s(group.data.now)}\n            `)]) : viewModel._e()
                ]),
                viewModel._v(" "),
                createElement("div", { staticClass: "proxy-section-right" }, [
                    renderSectionAction(labels.scrollToProxy(), "travel_explore", () => viewModel.scrollToSelected(groupIndex), viewModel.showSecIdxs.includes(groupIndex)),
                    viewModel._v(" "),
                    renderSectionAction(labels.showHieTimedOutProxies(), `report${viewModel.hideTimeoutSecNames.includes(group.name) ? "_off" : ""}`, () => viewModel.switchHideTimeout(group.name)),
                    viewModel._v(" "),
                    renderSectionAction(labels.testLatency(), "network_check", () => viewModel.startLatencyTest(group.name, groupIndex)),
                    viewModel._v(" "),
                    renderSectionAction("Show/hide proxies", `visibility${viewModel.showSecIdxs.includes(groupIndex) ? "" : "_off"}`, () => viewModel.switchVisible(groupIndex), ["rule", "script"].includes(viewModel.currentMode))
                ], 1)
            ]),
            viewModel._v(" "),
            createElement("transition", { attrs: { name: "fall-fade" } }, [
                !["rule", "script"].includes(viewModel.currentMode) || viewModel.showSecIdxs.includes(groupIndex)
                    ? createElement("div", { staticClass: "proxy-items" }, [
                        ...group.data.all.map((proxy, proxyIndex) => renderProxy(group, groupIndex, proxy, proxyIndex)),
                        ...Array.from({ length: 20 }, (_unused, index) => createElement("i", { key: `spacer-${index}`, style: { width: viewModel.proxyItemWidth } }))
                    ])
                    : viewModel._e()
            ])
        ], 1)]);

        return createElement("div", { attrs: { id: "main-proxy-view" } }, [
            createElement("proxy-mode-switcher", {
                attrs: { mode: viewModel.currentMode, "script-mode-visible": viewModel.scriptModeVisible },
                on: { switch: viewModel.handleModeSwitch }
            }),
            viewModel._v(" "),
            createElement("div", {
                ref: "mixin-scroll-content",
                staticClass: "scroll-view",
                on: { scroll: viewModel.handleListScroll }
            }, [
                ...viewModel.proxyInMode.map(renderGroup),
                viewModel.isShowNavigator ? createElement("navigator", {
                    attrs: {
                        list: viewModel.proxyInMode.map(group => group.name),
                        "error-indexes": viewModel.errorIndexes,
                        index: viewModel.topItemIndex,
                        width: viewModel.navigatorWidth
                    },
                    on: { select: viewModel.handleNavigateToGroup }
                }) : viewModel._e(),
                viewModel.proxyInMode.length === 0 && viewModel.currentMode !== "direct" ? createElement("div", { staticClass: "empty-hint" }, [
                    createElement("div", [viewModel._v(labels.noProxyGroupInProfile())]),
                    viewModel._v(" "),
                    createElement("div", [
                        viewModel._v(`\n        ${labels.profileDescribeStart()}\n        `),
                        createElement("span", { on: { click() { return viewModel.$router.replace({ path: "/home/server" }); } } }, [viewModel._v(labels.profiles())]),
                        viewModel._v(`\n        ${labels.profileDescribeEnd()}\n      `)
                    ])
                ]) : viewModel._e(),
                viewModel.currentMode === "direct" ? createElement("div", { staticClass: "empty-hint text-lg" }, [viewModel._v(`\n      ${labels.allTrafficGoDirectly()}\n    `)]) : viewModel._e()
            ], 2),
            viewModel._v(" "),
            viewModel.settings.showProxyFilter ? createElement("div", { staticClass: "filter-keyword" }, [
                createElement("transition", { attrs: { name: "move-right" } }, [
                    viewModel.isShowFilter ? createElement("input", {
                        directives: [{ name: "model", rawName: "v-model", value: viewModel.filterKeyword, expression: "filterKeyword" }],
                        ref: "filterKeyword",
                        attrs: { spellcheck: "false", type: "text" },
                        domProps: { value: viewModel.filterKeyword },
                        on: { input(event) { if (!event.target.composing) viewModel.filterKeyword = event.target.value; } }
                    }) : viewModel._e()
                ]),
                viewModel._v(" "),
                createElement("div", { on: { click: viewModel.handleFilterIconClick } }, [
                    createElement("span", { staticClass: "icon text-white" }, [viewModel._v(viewModel.isShowFilter ? "close" : "filter_list")])
                ])
            ], 1) : viewModel._e()
        ], 1);
    }, "0729f95b");

    return ProxiesPage;
}

module.exports = { createProxiesPage };
