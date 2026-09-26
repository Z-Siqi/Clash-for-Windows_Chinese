"use strict";

function createGeneralPage({
    defineComponent,
    Vuex,
    getLanguage,
    version,
    workflow,
    components,
    shell,
    fs,
    yaml,
    platform,
    utilities,
    scheduler,
    os
}) {
    const {
        SelectView,
        SwitchView,
        SimpleInput,
        EscCapture,
        InfoIcon,
        Hint
    } = components;

    const ErrorView = defineComponent({
        data() {
            return { retries: 0, logs: "", intervalID: null };
        },
        computed: {
            ...Vuex.mapState({
                clashPath: state => state.app.clashPath,
                logFilePath: state => state.app.logFilePath,
                errors: state => state.app.errors
            })
        },
        methods: {
            openLogsFolder() {
                this.$parent.$parent.showLogsFolder(true);
            },
            openHomeDir() {
                if (this.clashPath) shell.openPath(this.clashPath);
            },
            async autoFix() {
                const labels = getLanguage();
                const result = await utilities.showMessageBox({
                    title: "Clash for Windows",
                    type: "warning",
                    message: labels.pleaseConfirm(),
                    detail: labels.cfgWillBeRemoved(),
                    buttons: [labels.no(), labels.yes()]
                });
                if (result.response === 1) this.$parent.autoFix();
            }
        },
        mounted() {
            const refresh = () => {
                const labels = getLanguage();
                this.retries += 1;
                if (this.clashPath && this.logFilePath) {
                    try {
                        const content = fs.readFileSync(this.logFilePath);
                        const fatal = content.toString().split("\n")
                            .filter(line => /level=fatal/.test(line)).join("\n\n");
                        if (fatal) this.logs = fatal;
                        else if (this.errors.length > 0) this.logs = this.errors.join("\n");
                    } catch (_error) {}
                }
                if (this.retries > 3 && this.logs === "") this.logs = labels.failedConnectCore();
            };
            this.intervalID = scheduler.add(refresh, 2000);
            refresh();
        },
        beforeDestroy() {
            if (this.intervalID) {
                scheduler.stop(this.intervalID);
                this.intervalID = null;
            }
        }
    }, function renderErrorView() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        return createElement("div", {
            attrs: { id: "error-view-main" }
        }, [viewModel.logs ? createElement("div", {
            staticClass: "error-hints"
        }, [createElement("div", {
            attrs: { id: "error-title" }
        }, [viewModel._v(labels.error())]), viewModel._v(" "), createElement("div", {
            staticClass: "error-content"
        }, [viewModel._v(viewModel._s(viewModel.logs))]), viewModel._v(" "), createElement("div", {
            staticClass: "error-btns"
        }, [createElement("div", {
            staticClass: "error-hint",
            on: { click: viewModel.openHomeDir }
        }, [viewModel._v(labels.homeDirectory())]), viewModel._v(" "), createElement("div", {
            staticClass: "error-hint",
            on: { click: viewModel.openLogsFolder }
        }, [viewModel._v(labels.logsFolder())]), viewModel._v(" "), createElement("div", {
            staticClass: "error-hint",
            on: { click: viewModel.autoFix }
        }, [viewModel._v(labels.tryRepair())])])]) : createElement("div", {
            staticClass: "loading-hint"
        }, [viewModel._v(labels.loading())])]);
    }, "9ba71ad8");

    const EditList = defineComponent({
        name: "EditListView",
        model: { prop: "list", event: "changed" },
        props: {
            list: { type: Array, default: () => [] },
            disabled: { type: Boolean, default: false },
            placeHolder: { type: String, default: "" }
        },
        methods: {
            handleAddItem() {
                this.$emit("changed", [...this.list, ""]);
            },
            handleRemoveItem(index) {
                this.$emit("changed", [...this.list.slice(0, index), ...this.list.slice(index + 1)]);
            },
            handleChangeItem(event, index) {
                this.$emit("changed", [
                    ...this.list.slice(0, index), event.target.value, ...this.list.slice(index + 1)
                ]);
            }
        }
    }, function renderEditList() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", {
            staticClass: "main-edit-list-view"
        }, [viewModel._l(viewModel.list, (item, index) => createElement("div", {
                key: index,
                staticClass: "item"
            }, [createElement("input", {
                staticClass: "rounded-br-none rounded-tr-none",
                attrs: { type: "text", disabled: viewModel.disabled, placeholder: viewModel.placeHolder },
                domProps: { value: item },
                on: { input: event => viewModel.handleChangeItem(event, index) }
            }), viewModel._v(" "), viewModel.disabled ? viewModel._e() : createElement("div", {
                staticClass: "btn btn-remove clickable",
                on: { click: () => viewModel.handleRemoveItem(index) }
            }, [createElement("span", {
                staticClass: "icon text-white"
            }, [viewModel._v("remove")])])])), viewModel._v(" "), viewModel.disabled ? viewModel._e() : createElement("div", {
            staticClass: "btn btn-add clickable",
            on: { click: viewModel.handleAddItem }
        }, [createElement("span", {
            staticClass: "icon text-[#41b883]"
        }, [viewModel._v("add")])])], 2);
    }, "3ea6d831");

    const EditObject = defineComponent({
        name: "EditObjectView",
        model: { prop: "object", event: "changed" },
        props: {
            object: { type: Object, default: () => ({}) },
            disabled: { type: Boolean, default: false },
            valuePlaceHolder: { type: String, default: "" },
            keyPlaceHolder: { type: String, default: "" }
        },
        data() {
            return { addKey: "" };
        },
        methods: {
            handleAddItem() {
                if (this.addKey === "" || this.addKey in this.object) return;
                this.$emit("changed", { ...this.object, [this.addKey]: "" });
                this.addKey = "";
            },
            handleRemoveItem(key) {
                const next = { ...this.object };
                delete next[key];
                this.$emit("changed", next);
            },
            handleChangeValue(event, key) {
                this.$emit("changed", { ...this.object, [key]: event.target.value });
            }
        }
    }, function renderEditObject() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", {
            staticClass: "main-edit-object-view"
        }, [viewModel._l(Object.entries(viewModel.object), entry => {
            var key = entry[0], value = entry[1];
            return createElement("div", {
                key: key,
                staticClass: "item gap-1"
            }, [createElement("div", {
                staticClass: "max-w-[120px] text-ellipsis overflow-hidden whitespace-normal flex-shrink-0",
                attrs: { title: key }
            }, [viewModel._v(`\n      ${viewModel._s(key)}\n    `)]), viewModel._v(" "), createElement("span", [viewModel._v(":")]), viewModel._v(" "), createElement("input", {
                attrs: { type: "text", disabled: viewModel.disabled, placeholder: viewModel.valuePlaceHolder },
                domProps: { value: value },
                on: { input: event => viewModel.handleChangeValue(event, key) }
            }), viewModel._v(" "), viewModel.disabled ? viewModel._e() : createElement("div", {
                staticClass: "btn btn-remove clickable flex-shrink-0",
                on: { click: () => viewModel.handleRemoveItem(key) }
            }, [createElement("span", {
                staticClass: "icon text-white"
            }, [viewModel._v("remove")])])]);
        }), viewModel._v(" "), viewModel.disabled ? viewModel._e() : createElement("div", {
            staticClass: "flex items-center gap-2",
            on: { click: viewModel.handleAddItem }
        }, [createElement("input", {
            directives: [{ name: "model", rawName: "v-model", value: viewModel.addKey, expression: "addKey" }],
            attrs: { type: "text", placeholder: viewModel.keyPlaceHolder },
            domProps: { value: viewModel.addKey },
            on: { input: event => { if (!event.target.composing) viewModel.addKey = event.target.value; } }
        }), viewModel._v(" "), createElement("span", {
            staticClass: "btn btn-add clickable icon text-[#41b883]"
        }, [viewModel._v("add")])])], 2);
    }, "352b843a");

    const TunSettingsView = defineComponent({
        name: "TunSettingsView",
        components: { SelectView, SwitchView, SimpleInput, EditList, EscCapture, EditObject },
        data() {
            return {
                ipv6: false,
                stackType: 0,
                nameServers: [],
                fallbackServers: [],
                defaultNameservers: [],
                fakeIPFilters: [],
                nameserverPolicy: {},
                isAutoDetectInterface: true,
                interfaceName: "",
                dnsHijacks: [],
                isAutoRedir: false,
                isAutoRedirAutoRoute: false
            };
        },
        computed: {
            ...Vuex.mapState({ tunSettings: state => state.app.tunSettings }),
            obj() { return utilities.buildTunConfig(this.$data); },
            text() { return yaml.stringify(this.obj); }
        },
        methods: {
            ...Vuex.mapMutations({ setTunSettings: "SET_TUN_SETTINGS" }),
            handleSave() {
                this.setTunSettings({ settings: this.$data });
                this.$emit("close");
            },
            handleReset() { this.setupComponent({}); },
            handleOpenDocument() {
                shell.openExternal("https://web.archive.org/web/20231001060822/dreamacro.github.io/clash/configuration/configuration-reference.html");
            },
            setupComponent(settings = {}) {
                const {
                    ipv6,
                    nameServers,
                    fallbackServers,
                    defaultNameservers,
                    fakeIPFilters,
                    nameserverPolicy,
                    stackType,
                    isAutoDetectInterface,
                    interfaceName,
                    dnsHijacks,
                    isAutoRedir,
                    isAutoRedirAutoRoute
                } = settings;
                this.ipv6 = ipv6 !== undefined && ipv6;
                this.stackType = [0, 1].includes(stackType) ? stackType : 0;
                this.nameServers = nameServers || ["8.8.8.8", "1.1.1.1", "94.140.14.14"];
                this.fallbackServers = fallbackServers || [];
                this.defaultNameservers = defaultNameservers || [];
                this.fakeIPFilters = fakeIPFilters || [
                    "+.stun.*.*", "+.stun.*.*.*", "+.stun.*.*.*.*", "+.stun.*.*.*.*.*",
                    "*.n.n.srv.nintendo.net", "+.stun.playstation.net", "xbox.*.*.microsoft.com",
                    "*.*.xboxlive.com",
                    ...(platform.isWindows() ? ["*.msftncsi.com", "*.msftconnecttest.com", "WORKGROUP"]
                        : platform.isMacOS() ? ["apps.apple.com"] : [])
                ];
                this.nameserverPolicy = nameserverPolicy || {};
                this.isAutoDetectInterface = isAutoDetectInterface === undefined || isAutoDetectInterface;
                this.interfaceName = interfaceName || "";
                this.dnsHijacks = dnsHijacks || ["any:53"];
                this.isAutoRedir = isAutoRedir !== undefined && isAutoRedir;
                this.isAutoRedirAutoRoute = isAutoRedirAutoRoute !== undefined && isAutoRedirAutoRoute;
            }
        },
        mounted() { this.setupComponent(this.tunSettings || {}); }
    }, function renderTunSettingsView() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const renderModelComponent = (component, propertyName, attributes = {}) => createElement(component, {
            attrs: attributes,
            model: {
                value: viewModel[propertyName],
                callback: value => { viewModel[propertyName] = value; },
                expression: propertyName
            }
        });
        const renderSection = (label, content, className) => createElement("div", {
            ...(className ? { staticClass: className } : {})
        }, [
            createElement("div", [viewModel._v(label)]),
            viewModel._v(" "),
            content
        ], 1);

        return createElement("EscCapture", {
            staticClass: "main-tun-settings-view bg-[color:var(--mask-c)]",
            on: {
                esc: () => viewModel.$emit("close"),
                mousedown: () => viewModel.$emit("close")
            }
        }, [createElement("div", {
            staticClass: "content bg-[color:var(--bgc)] text-[color:var(--fgc)]",
            on: { mousedown: event => event.stopPropagation() }
        }, [
            createElement("div", { staticClass: "title" }, [viewModel._v(labels.modeSettingsTUN())]),
            viewModel._v(" "),
            createElement("div", { staticClass: "pannel" }, [
                createElement("div", {
                    staticClass: "left border-[1px] border-[color:var(--bc)]"
                }, [
                    renderSection("DNS IPv6", renderModelComponent("SwitchView", "ipv6"), "flex"),
                    viewModel._v(" "),
                    renderSection(labels.serversDNS(), renderModelComponent("EditList", "nameServers", {
                        placeHolder: labels.eg() + "8.8.8.8"
                    })),
                    viewModel._v(" "),
                    renderSection(labels.fallbackDNSServers(), renderModelComponent("EditList", "fallbackServers", {
                        placeHolder: labels.eg() + "8.8.8.8"
                    })),
                    viewModel._v(" "),
                    renderSection(labels.deaultNameserver(), renderModelComponent("EditList", "defaultNameservers", {
                        placeHolder: labels.eg() + "8.8.8.8"
                    })),
                    viewModel._v(" "),
                    renderSection(labels.fakeIPFilter(), renderModelComponent("EditList", "fakeIPFilters", {
                        placeHolder: labels.eg() + "*.lan"
                    })),
                    viewModel._v(" "),
                    renderSection(labels.nameserverPolicy(), renderModelComponent("EditObject", "nameserverPolicy", {
                        keyPlaceHolder: labels.domain(),
                        valuePlaceHolder: labels.server()
                    })),
                    viewModel._v(" "),
                    renderSection(labels.hijacksDNS(), renderModelComponent("EditList", "dnsHijacks", {
                        placeHolder: labels.eg() + "any:53"
                    })),
                    viewModel._v(" "),
                    renderSection(labels.stackTUN(), renderModelComponent("SelectView", "stackType", {
                        items: ["gvisor", "system"]
                    }), "flex"),
                    viewModel._v(" "),
                    renderSection(labels.autoDetectInterface(), renderModelComponent(
                        "SwitchView",
                        "isAutoDetectInterface"
                    ), "flex"),
                    viewModel._v(" "),
                    viewModel.isAutoDetectInterface ? viewModel._e() : createElement("div", {
                        staticClass: "flex"
                    }, [
                        createElement("div", [viewModel._v(labels.interfaceName())]),
                        viewModel._v(" "),
                        createElement("input", {
            directives: [{ name: "model", rawName: "v-model", value: viewModel.interfaceName, expression: "interfaceName" }],
            attrs: { type: "text" },
                            domProps: { value: viewModel.interfaceName },
                            on: {
                                input: event => {
                                    if (!event.target.composing) viewModel.interfaceName = event.target.value;
                                }
                            }
                        })
                    ]),
                    viewModel._v(" "),
                    viewModel.isLinux
                        ? renderSection("Auto Redir", renderModelComponent("SwitchView", "isAutoRedir"), "flex")
                        : viewModel._e(),
                    viewModel._v(" "),
                    viewModel.isLinux && viewModel.isAutoRedir
                        ? renderSection(
                            "Auto Route(Auto Redir)",
                            renderModelComponent("SwitchView", "isAutoRedirAutoRoute"),
                            "flex"
                        )
                        : viewModel._e()
                ]),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "right border-[1px] border-[color:var(--bc)]"
                }, [createElement("pre", [viewModel._v(viewModel._s(viewModel.text))])])
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "btns" }, [
                createElement("div", {
                    staticClass: "btn clickable",
                    on: { click: viewModel.handleReset }
                }, [viewModel._v(labels.reset())]),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "btn clickable",
                    on: { click: viewModel.handleOpenDocument }
                }, [viewModel._v(labels.docs())]),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "btn clickable",
                    on: { click: viewModel.handleSave }
                }, [viewModel._v(labels.save())])
            ])
        ])]);
    }, "b6dface2");

    const ResetDNSSettingsView = defineComponent({
        name: "ResetDNSSettingsView",
        components: { SelectView, SwitchView, SimpleInput, EditList, EscCapture },
        data() {
            return { servers: [], isUsingCustom: false };
        },
        computed: {
            ...Vuex.mapState({ userDNS: state => state.app.userDNS })
        },
        methods: {
            handleSave() {
                this.settings.isUsingResetDNSServers = this.isUsingCustom;
                this.settings.resetDNSServers = this.servers;
                this.$emit("close");
            },
            setupComponent() {
                this.isUsingCustom = this.settings.isUsingResetDNSServers;
                this.servers = this.settings.resetDNSServers;
            }
        },
        mounted() { this.setupComponent(); }
    }, function renderResetDNSSettingsView() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const renderList = (propertyName, disabled = false) => createElement("EditList", {
            attrs: { disabled },
            model: {
                value: viewModel[propertyName],
                callback: value => { viewModel[propertyName] = value; },
                expression: propertyName
            }
        });
        return createElement("EscCapture", {
            staticClass: "main-tun-settings-view bg-[color:var(--mask-c)]",
            on: {
                esc: () => viewModel.$emit("close"),
                mousedown: () => viewModel.$emit("close")
            }
        }, [createElement("div", {
            staticClass: "content bg-[color:var(--bgc)] text-[color:var(--fgc)]",
            on: { mousedown: event => event.stopPropagation() }
        }, [createElement("div", {
            staticClass: "title"
        }, [viewModel._v(labels.resetDNSSettings())]), viewModel._v(" "), createElement("div", {
            staticClass: "font-normal mb-1 text-sm hint"
        }, [
            viewModel._v("\n      If "),
            createElement("span", [viewModel._v(labels.enabled())]),
            viewModel._v(", "),
            createElement("span", [viewModel._v(labels.customServers())]),
            viewModel._v(" will be used to\n      reset the system DNS after TUN mode is disabled. Otherwise,\n      "),
            createElement("span", [viewModel._v("Detected Servers")]),
            viewModel._v("\n      will be used.\n    ")
        ]), viewModel._v(" "), createElement("div", {
            staticClass: "pannel"
        }, [createElement("div", {
            staticClass: "left border-[1px] border-[color:var(--bc)]"
        }, [createElement("div", {
            staticClass: "flex"
        }, [createElement("div", [viewModel._v(labels.enable())]), viewModel._v(" "), createElement("SwitchView", {
            model: {
                value: viewModel.isUsingCustom,
                callback: value => { viewModel.isUsingCustom = value; },
                expression: "isUsingCustom"
            }
        })], 1), viewModel._v(" "), createElement("div", [
            createElement("div", [viewModel._v("Custom Servers:")]),
            viewModel._v(" "),
            renderList("servers")
        ], 1)]), viewModel._v(" "), createElement("div", {
            staticClass: "right border-[1px] border-[color:var(--bc)]"
        }, [createElement("div", [
            createElement("div", [viewModel._v("Detected Servers:")]),
            viewModel._v(" "),
            renderList("userDNS", true)
        ], 1)])]), viewModel._v(" "), createElement("div", {
            staticClass: "btns"
        }, [createElement("div"), viewModel._v(" "), createElement("div", {
            staticClass: "btn clickable",
            on: { click: viewModel.handleSave }
        }, [viewModel._v(labels.save())])])])]);
    }, "47896be6");

    const InterfacesView = defineComponent({
        name: "InterfacesView",
        components: { EscCapture, SelectView },
        data() {
            return { interfaces: [], ipvIndex: 0 };
        },
        computed: {
            ifs() {
                return this.interfaces.reduce((result, item) => {
                    const addrs = item.addrs.filter(address => address.family === ["IPv4", "IPv6"][this.ipvIndex]);
                    if (addrs.length > 0) result.push({ name: item.name, addrs });
                    return result;
                }, []);
            }
        },
        mounted() {
            this.interfaces = Object.entries(os.networkInterfaces()).map(([name, addrs]) => ({ name, addrs }));
        }
    }, function renderInterfacesView() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const renderAddress = address => createElement("div", {
            key: address.address,
            staticClass: "text-sm flex flex-col",
            style: { color: address.internal ? "#D44545" : "#13AF42" }
        }, [
            createElement("div", { staticClass: "flex" }, [
                createElement("span", { staticClass: "w-[80px]" }, [viewModel._v("Address:")]),
                viewModel._v(" "),
                createElement("span", [viewModel._v(viewModel._s(address.address))])
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "flex" }, [
                createElement("span", { staticClass: "w-[80px]" }, [viewModel._v("Netmask:")]),
                viewModel._v(" "),
                createElement("span", [
                    viewModel._v(`${viewModel._s(address.netmask)}\n              `),
                    address.cidr
                        ? createElement("span", [viewModel._v(`(${viewModel._s(address.cidr.split("/")[1])})`)])
                        : viewModel._e()
                ])
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "flex" }, [
                createElement("span", { staticClass: "w-[80px]" }, [viewModel._v("MAC:")]),
                viewModel._v(" "),
                createElement("span", [viewModel._v(viewModel._s(address.mac))])
            ])
        ]);
        return createElement("EscCapture", {
            staticClass: "w-[calc(100%_-_170px)] h-[calc(100%_-_25px)] absolute top-[25px] left-[170px] bg-[color:var(--mask-c)] flex flex-col justify-center items-center",
            on: {
                esc: () => viewModel.$emit("close"),
                mousedown: () => viewModel.$emit("close")
            }
        }, [createElement("div", {
            staticClass: "w-[500px] max-h-[500px] rounded bg-[color:var(--bgc)] text-[color:var(--fgc)] overflow-auto flex flex-col items-center",
            on: { mousedown: event => event.stopPropagation() }
        }, [createElement("div", {
            staticClass: "flex justify-between w-full bg-[color:var(--bgc)] px-5 py-3 border-[color:var(--bc)] border-b"
        }, [createElement("span", [viewModel._v(labels.networkInterfaces())]), viewModel._v(" "), createElement("SelectView", {
            attrs: { items: ["IPv4", "IPv6"] },
            model: {
                value: viewModel.ipvIndex,
                callback: value => { viewModel.ipvIndex = value; },
                expression: "ipvIndex"
            }
        })], 1), viewModel._v(" "), createElement("div", {
            staticClass: "list w-full flex-grow flex flex-col gap-2 px-5 py-4"
        }, viewModel._l(viewModel.ifs, networkInterface => createElement("div", {
                key: networkInterface.name,
                staticClass: "if-list rounded w-full"
            }, [createElement("span", {
                staticClass: "text-base w-full text-center"
            }, [viewModel._v(viewModel._s(networkInterface.name))]),
            viewModel._v(" "),
            viewModel._l(networkInterface.addrs, renderAddress)
        ], 2)), 0)])]);
    }, "d9b850ea");

    const GeneralPage = defineComponent({
        components: {
            ErrorView,
            TunSettingsView,
            ResetDNSSettingsView,
            InterfacesView,
            SwitchView,
            SelectView,
            InfoIcon,
            Hint
        },
        data: workflow.data,
        watch: workflow.watch,
        computed: {
            ...Vuex.mapState({
                devMode: state => state.app.isDevMode,
                clashPath: state => state.app.clashPath,
                clashStatus: state => state.app.clashStatus,
                confData: state => state.app.confData,
                isMixinEnable: state => state.app.isMixinEnable,
                isTunEnable: state => state.app.isTunEnable,
                status: state => state.app.status,
                isWindowShow: state => state.app.isWindowShow,
                isLocalMode: state => state.app.isLocalMode,
                isLaunching: state => state.app.isLaunching,
                isSystemProxyOn: state => state.app.isSystemProxyOn,
                isSilentUpgraded: state => state.app.isSilentUpgraded,
                updateDownloadProgress: state => state.app.updateDownloadProgress,
                isFirewallRuleExist: state => state.app.isFirewallRuleExist,
                currentProfilePayload: state => state.app.currentProfilePayload,
                matchedSSID: state => state.app.matchedSSID
            }),
            ...Vuex.mapGetters([
                "resourcesPath", "filesPath", "mixedPort", "clashAxiosClient",
                "controllerPort", "secret"
            ]),
            ...workflow.computed
        },
        methods: {
            ...Vuex.mapMutations({
                changeIsMixinEnable: "CHANGE_IS_MIXIN_ENABLE",
                changeIsTunEnable: "CHANGE_IS_TUN_ENABLE",
                setIsLocalMode: "SET_IS_LOCAL_MODE",
                setConfData: "SET_CONF_DATA",
                setIsSystemProxyOn: "SET_IS_SYSTEM_PROXY_ON",
                setIsFirewallRuleExist: "SET_IS_FIREWALL_RULE_EXIST"
            }),
            ...workflow.methods
        },
        mounted: workflow.mounted,
        beforeRouteEnter: workflow.beforeRouteEnter,
        beforeRouteLeave: workflow.beforeRouteLeave
    }, function renderGeneralPage() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const logLevelLabels = {
            silent: labels.silent(),
            error: labels.errorS(),
            warn: labels.warning(),
            warning: labels.warn(),
            info: labels.info(),
            debug: labels.debug()
        };
        const normalizeChildren = content => {
            const children = Array.isArray(content) ? content : [content];
            return children.map(child => typeof child === "string" ? viewModel._v(child) : child);
        };
        const renderItem = (leftContent, rightContent, extraChildren = []) => createElement("div", {
            staticClass: "item"
        }, [
            createElement("div", { staticClass: "item-left" }, normalizeChildren(leftContent)),
            viewModel._v(" "),
            ...extraChildren,
            createElement("div", { staticClass: "item-right" }, normalizeChildren(rightContent))
        ]);
        const stopAndRun = action => event => {
            event.stopPropagation();
            action(event);
        };
        const renderHintIcon = ({
            hint,
            icon,
            onClick,
            staticClass = "tun-settings-icon",
            position = "right",
            iconClass = "icon text-[color:var(--general-settings-icon-c)]",
            style
        }) => createElement("Hint", {
            staticClass,
            attrs: { hint, position },
            on: { click: onClick }
        }, [createElement("span", {
            staticClass: iconClass,
            ...(style ? { style } : {})
        }, [viewModel._v(viewModel._s(icon))])]);
        const renderSwitch = (enabled, handler) => createElement("switch-view", {
            attrs: { on: enabled },
            on: { change: handler }
        });

        const contentItems = [
            renderItem(labels.port(), [
                createElement("Hint", {
                    staticClass: "mr-2",
                    attrs: { hint: labels.terminal() }
                }, [createElement("span", {
                    staticClass: "icon control-icon",
                    on: { click: stopAndRun(viewModel.openCmdWithProxy) }
                }, [viewModel._v("terminal")])]),
                viewModel._v(" "),
                createElement("Hint", { attrs: { hint: labels.randomMixedPort() } }, [
                    createElement("span", {
                        staticClass: "icon control-icon cursor-pointer",
                        style: { color: viewModel.settings.randomMixedPort ? "#41b883" : "#b3b3b3" },
                        on: {
                            click: () => {
                                viewModel.settings.randomMixedPort = !viewModel.settings.randomMixedPort;
                            }
                        }
                    }, [viewModel._v(`sync${viewModel._s(viewModel.settings.randomMixedPort ? "" : "_disabled")}`)])
                ]),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "clickable",
                    on: { click: viewModel.handleEditMixedPort }
                }, [viewModel._v(`\n          ${viewModel._s(viewModel.port)}\n        `)])
            ]),
            viewModel._v(" "),
            renderItem([
                createElement("div", [viewModel._v(labels.allowLAN())]),
                viewModel._v(" "),
                createElement("info-icon", [
                    viewModel._v(`\n          ${labels.infoAllowLAN()}\n          `),
                    createElement("a", {
                        attrs: { href: "https://github.com/Dreamacro/clash/pull/2818" }
                    }, [viewModel._v(labels.inbound())])
                ]),
                viewModel._v(" "),
                renderHintIcon({
                    hint: labels.networkInterfaces(),
                    icon: "device_hub",
                    onClick: stopAndRun(() => { viewModel.isInterfacesVisible = true; })
                })
            ], [
                viewModel.bindAddress ? createElement("div", {
                    staticClass: "clickable mr-2",
                    on: { click: viewModel.handleEditBindAddress }
                }, [viewModel._v(`\n          ${labels.bind()}${viewModel._s(viewModel.bindAddress)}\n        `)]) : viewModel._e(),
                viewModel._v(" "),
                renderSwitch(viewModel.isAllowLan, () => viewModel.handleAllowLANChange(viewModel.isAllowLan))
            ]),
            viewModel._v(" "),
            renderItem(labels.logLevel(), createElement("div", {
                staticClass: "clickable",
                on: { click: viewModel.handleEditLogLevel }
            }, [viewModel._v(`\n          ${logLevelLabels[String(viewModel.logLevel)] || viewModel._s(viewModel.logLevel)}\n        `)])),
            viewModel._v(" "),
            renderItem("IPv6", renderSwitch(viewModel.isIPV6, () => viewModel.handleIPV6Change(viewModel.isIPV6))),
            viewModel._v(" "),
            renderItem([
                createElement("div", [viewModel._v(labels.clashCore())]),
                viewModel._v(" "),
                viewModel.isWindows ? renderHintIcon({
                    hint: labels.addFirewallRules(),
                    icon: viewModel.isFetchingFirewallRule
                        ? "edit"
                        : viewModel.isFirewallRuleExist ? "verified_user" : "gpp_maybe",
                    onClick: viewModel.handleAddFirewallRules,
                    iconClass: viewModel.isFetchingFirewallRule
                        ? "icon text-[color:var(--general-settings-icon-c)] animate-bounce"
                        : "icon text-[color:var(--general-settings-icon-c)]",
                    style: viewModel.isFetchingFirewallRule ? undefined : {
                        color: viewModel.isFirewallRuleExist ? "#41b883" : "#b3b3b3"
                    }
                }) : viewModel._e(),
                viewModel._v(" "),
                renderHintIcon({
                    hint: labels.previewCfgToClashCore(),
                    icon: "memory",
                    onClick: stopAndRun(viewModel.handlePreviewCurrentPayload)
                }),
                viewModel._v(" "),
                renderHintIcon({
                    hint: labels.useClashCoreSeeHost(),
                    icon: "dns",
                    onClick: stopAndRun(viewModel.handleShowDNSQueryDialog)
                }),
                viewModel._v(" "),
                renderHintIcon({
                    hint: labels.testByScriptMode(),
                    icon: "play_arrow",
                    onClick: stopAndRun(viewModel.handleShowScriptTestDialog)
                })
            ], createElement("div", {
                staticClass: "clickable",
                on: { click: viewModel.handleCopyControllerURL }
            }, [viewModel._v(`\n          ${viewModel._s(viewModel.clashCoreVersion)} (${viewModel._s(viewModel.controllerPort)})\n        `)])),
            viewModel._v(" "),
            renderItem(labels.homeDirectory(), createElement("div", {
                staticClass: "clickable",
                on: { click: viewModel.handleHomeDirectoryOpen }
            }, [viewModel._v(`\n        ${labels.openFolder()}\n      `)])),
            viewModel._v(" "),
            viewModel.isWindows ? viewModel._e() : renderItem(labels.geoIPDatabase(), createElement("div", {
                staticClass: "clickable",
                on: { click: viewModel.handleGeoipDatabaseUpdate }
            }, [viewModel._v(`\n        ${viewModel._s(viewModel.geoipUpdateTime)}\n      `)])),
            viewModel._v(" "),
            viewModel.isWindows ? renderItem(labels.loopbackUWP(), createElement("div", {
                staticClass: "clickable",
                on: { click: event => viewModel.spawnLoopback(event) }
            }, [viewModel._v(`\n        ${labels.launchHelper()}\n      `)])) : viewModel._e(),
            viewModel._v(" "),
            viewModel.isWindows ? renderItem(labels.deviceTAP(), createElement("div", {
                staticClass: "clickable",
                on: { click: event => viewModel.installTapDevice(event) }
            }, [viewModel._v(`\n        ${labels.manage()}\n      `)])) : viewModel._e(),
            viewModel._v(" "),
            createElement("div", { staticClass: "item" }, [
                createElement("div", { staticClass: "item-left" }, [viewModel._v(labels.serviceMode())]),
                viewModel._v(" "),
                createElement("span", {
                    staticClass: "icon mt-[2px] ml-[5px]",
                    style: {
                        color: viewModel.isLocalMode
                            ? "#b3b3b3"
                            : viewModel.serviceNeedUpdate ? "#DE5034" : "#41b883"
                    }
                }, [viewModel._v("public")]),
                viewModel._v(" "),
                createElement("div", { staticStyle: { "flex-grow": "1" } }),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "item-right clickable",
                    on: { click: viewModel.installService }
                }, [viewModel._v(labels.manage())])
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "item" }, [
                createElement("div", { staticClass: "item-left" }, [
                    createElement("div", [viewModel._v(labels.TUNmode())]),
                    viewModel._v(" "),
                    createElement("info-icon", [viewModel._v(`\n          ${labels.TUNmodeDescribe()}\n        `)]),
                    viewModel._v(" "),
                    renderHintIcon({
                        hint: labels.settings(),
                        icon: "settings",
                        onClick: stopAndRun(() => {
                            viewModel.isTunSettingsVisible = !viewModel.isTunSettingsVisible;
                        })
                    }),
                    viewModel._v(" "),
                    viewModel.isMacOS ? renderHintIcon({
                        hint: "System DNS servers that will be set after TUN Mode is disabled",
                        icon: "manage_history",
                        onClick: stopAndRun(() => {
                            viewModel.isResetDNSSettingsVisible = !viewModel.isResetDNSSettingsVisible;
                        })
                    }) : viewModel._e()
                ]),
                viewModel._v(" "),
                renderSwitch(viewModel.isTunEnable, viewModel.handleTunSwitchClick)
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "item" }, [
                createElement("div", { staticClass: "item-left" }, [
                    createElement("div", [viewModel._v(labels.mixin())]),
                    viewModel._v(" "),
                    createElement("info-icon", [
                        viewModel._v(`\n          ${labels.mixinAllowsDescribe()}\n          `),
                        createElement("a", {
                            attrs: { href: "https://web.archive.org/web/20230304232259/docs.cfw.lbyczf.com/contents/mixin.html" }
                        }, [viewModel._v(labels.onlineDocs())])
                    ]),
                    viewModel._v(" "),
                    renderHintIcon({
                        hint: labels.editMixinContent(),
                        icon: "settings",
                        onClick: stopAndRun(viewModel.handleEditMixin)
                    })
                ]),
                viewModel._v(" "),
                renderSwitch(viewModel.isMixinEnable, viewModel.handleMixinSwitchClick)
            ]),
            viewModel._v(" "),
            viewModel.isLinux ? viewModel._e() : renderItem(
                labels.sysProxy(),
                renderSwitch(viewModel.isSystemProxyOn, viewModel.handleSystemProxySwitchClick)
            ),
            viewModel._v(" "),
            renderItem(
                viewModel._s(viewModel.autoLaunchHint),
                renderSwitch(viewModel.autoLaunch, viewModel.handleAutoLaunchSwitchClick)
            )
        ];

        return createElement("div", { staticClass: "main-general-view" }, [
            createElement("div", { staticClass: "header" }, [
                createElement("img", {
                    staticClass: "w-[90px] h-[90px] mr-[20px]",
                    attrs: { src: viewModel.iconPath }
                }),
                viewModel._v(" "),
                createElement("div", { staticClass: "title" }, [
                    createElement("div", {
                        staticClass: "title-name",
                        on: { click: viewModel.handleTitleClick }
                    }, [viewModel._v("\n        Clash for Windows\n      ")]),
                    viewModel._v(" "),
                    createElement("div", {
                        staticClass: "version",
                        on: { click: viewModel.openGithubRelease }
                    }, [
                        viewModel._v(`\n        ${version}\n        `),
                        viewModel.isShowNewIcon
                            ? createElement("div", { staticClass: "new-version-tag" }, [viewModel._v("New")])
                            : viewModel._e()
                    ])
                ])
            ]),
            viewModel._v(" "),
            viewModel.isLaunching
                ? viewModel._e()
                : createElement("div", { staticClass: "content" }, contentItems),
            viewModel._v(" "),
            viewModel.matchedSSID ? createElement("div", {
                staticClass: "font-normal text-xs flex items-center justify-center absolute bottom-3 left-[calc(50%+85px)] -translate-x-1/2 gap-x-1 rounded-md bg-[color:var(--proxy-item-bgc)] border-opacity-50 px-3 py-1 clickable !border-b-0",
                on: { click: viewModel.handleEditSSIDStrategyText }
            }, [
                createElement("span", [viewModel._v(`${labels.ssidStrategy()}:`)]),
                viewModel._v(" "),
                createElement("span", [viewModel._v(viewModel._s(viewModel.matchedSSID))])
            ]) : viewModel._e(),
            viewModel._v(" "),
            viewModel.isLaunching ? createElement("error-view") : viewModel._e(),
            viewModel._v(" "),
            viewModel.isResetDNSSettingsVisible ? createElement("ResetDNSSettingsView", {
                on: { close: () => { viewModel.isResetDNSSettingsVisible = false; } }
            }) : viewModel._e(),
            viewModel._v(" "),
            viewModel.isTunSettingsVisible ? createElement("tun-settings-view", {
                on: { close: () => { viewModel.isTunSettingsVisible = false; } }
            }) : viewModel._e(),
            viewModel._v(" "),
            viewModel.isInterfacesVisible ? createElement("interfaces-view", {
                on: { close: () => { viewModel.isInterfacesVisible = false; } }
            }) : viewModel._e(),
            viewModel._v(" "),
            createElement("div", { staticClass: "empty-div" })
        ], 1);
    }, "357ec510");

    return GeneralPage;
}

module.exports = { createGeneralPage };
