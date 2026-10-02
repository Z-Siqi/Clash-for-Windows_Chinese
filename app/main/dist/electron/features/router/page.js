"use strict";

function createRouterPage({
    defineComponent,
    Vuex,
    getLanguage,
    cache,
    keys,
    dhcpService,
    getNetworkInterfaces
}) {
    const ConfigView = defineComponent({
        name: "RouterConfigView",
        data() {
            return {
                interfaces: [], selectedName: "", localAddress: "", rangeFrom: "", rangeTo: "",
                netmask: "255.255.255.0", defaultRouter: "", primaryDns: "8.8.8.8",
                secondlyDns: "1.1.1.1", broadAddress: ""
            };
        },
        computed: {
            selectedInterface() { return this.interfaces.find(item => item.name === this.selectedName); }
        },
        watch: {
            selectedInterface(value) {
                if (!value) return;
                this.localAddress = value.address;
                this.computeFromLocalAddress(value.address);
            }
        },
        methods: {
            computeFromLocalAddress(address) {
                const segments = address.split(".");
                if (segments.length !== 4) return;
                this.rangeFrom = [...segments.slice(0, 3), "100"].join(".");
                this.rangeTo = [...segments.slice(0, 3), "200"].join(".");
                this.defaultRouter = [...segments.slice(0, 3), "1"].join(".");
                this.broadAddress = [...segments.slice(0, 3), "255"].join(".");
            },
            async handleInterfaceSelect() {
                const items = this.interfaces.map(item => item.name);
                const [selection] = await this.$select({
                    title: getLanguage().selectInterface(), message: "", items
                });
                this.selectedName = items[selection];
            },
            handleContinueClick() {
                this.$emit("confirm", {
                    localAddress: this.localAddress,
                    rangeFrom: this.rangeFrom,
                    rangeTo: this.rangeTo,
                    netmask: this.netmask,
                    defaultRouter: this.defaultRouter,
                    primaryDns: this.primaryDns,
                    secondlyDns: this.secondlyDns,
                    broadAddress: this.broadAddress
                });
            }
        },
        async mounted() {
            this.interfaces = await getNetworkInterfaces() || [];
            if (this.interfaces.length > 0) this.selectedName = this.interfaces[0].name;
        }
    }, function renderConfigView() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const modelInput = propertyName => createElement("input", {
            directives: [{
                name: "model",
                rawName: "v-model",
                value: viewModel[propertyName],
                expression: propertyName
            }],
            attrs: { type: "text" },
            domProps: { value: viewModel[propertyName] },
            on: {
                input: event => {
                    if (!event.target.composing) viewModel[propertyName] = event.target.value;
                }
            }
        });
        return createElement("div", {
            staticClass: "main-router-config-view bg-[color:var(--mask-c)]",
            on: { click: () => viewModel.$emit("close") }
        }, [createElement("div", {
            staticClass: "content bg-[color:var(--bgc)] text-[color:var(--fgc)]",
            on: { click: event => event.stopPropagation() }
        }, [
            createElement("div", { staticClass: "title" }, [viewModel._v(labels.profiles())]),
            viewModel._v(" "),
            createElement("div", { staticClass: "sec" }, [
                createElement("span", [viewModel._v("Interface")]),
                viewModel._v(" "),
                createElement("input", {
                    staticClass: "clickable",
                    attrs: { readonly: "" },
                    domProps: { value: viewModel.selectedName },
                    on: { click: viewModel.handleInterfaceSelect }
                })
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "sec" }, [
                createElement("span", [viewModel._v(labels.localIpAddress())]),
                viewModel._v(" "),
                modelInput("localAddress")
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "sec" }, [
                createElement("span", [viewModel._v("DHCP IP Range")]),
                viewModel._v(" "),
                createElement("div", { staticClass: "flex" }, [
                    createElement("div", [
                        createElement("span", [viewModel._v("From")]),
                        viewModel._v(" "),
                        modelInput("rangeFrom")
                    ]),
                    viewModel._v(" "),
                    createElement("div", [
                        createElement("span", [viewModel._v("To")]),
                        viewModel._v(" "),
                        modelInput("rangeTo")
                    ])
                ])
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "sec" }, [
                createElement("span", [viewModel._v("Netmask")]),
                viewModel._v(" "),
                modelInput("netmask")
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "sec" }, [
                createElement("span", [viewModel._v("Default Router")]),
                viewModel._v(" "),
                modelInput("defaultRouter")
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "sec" }, [
                createElement("span", [viewModel._v(labels.serversDNS())]),
                viewModel._v(" "),
                createElement("div", { staticClass: "flex" }, [
                    createElement("div", [
                        createElement("span", [viewModel._v("Primary")]),
                        viewModel._v(" "),
                        modelInput("primaryDns")
                    ]),
                    viewModel._v(" "),
                    createElement("div", [
                        createElement("span", [viewModel._v("Alternative")]),
                        viewModel._v(" "),
                        modelInput("secondlyDns")
                    ])
                ])
            ]),
            viewModel._v(" "),
            createElement("div", {
                staticClass: "btn clickable",
                on: { click: viewModel.handleContinueClick }
            }, [viewModel._v("Continue")])
        ])]);
    }, "0ffa25f2");

    const RouterPage = defineComponent({
        name: "RouterView",
        components: { ConfigView },
        data() {
            return {
                server: null,
                clients: [],
                boundState: {},
                isShowConfigView: false,
                starting: false,
                clientAlias: cache.get(keys.DHCP_MAC_ALIAS) || {}
            };
        },
        computed: {
            ...Vuex.mapState({
                routerHijackMacAddresses: state => state.app.routerHijackMacAddresses,
                currentProfilePayload: state => state.app.currentProfilePayload
            }),
            serverRunning() { return this.server !== null; },
            buttonText() { return this.serverRunning ? getLanguage().pause() : getLanguage().start(); }
        },
        watch: {
            routerHijackMacAddresses() { this.updateDhcpPolicy(); },
            currentProfilePayload() { this.updateDhcpPolicy(); }
        },
        methods: {
            ...Vuex.mapMutations({ setRouterHijackMacAddresses: "SET_ROUTER_HIJACK_MAC_ADDRESSES" }),
            clientName(client) { return this.clientAlias[client.chaddr] || client.options[12] || "Unknown"; },
            handleClientRename(event, address) {
                this.clientAlias = { ...this.clientAlias, [address]: event.target.value };
                cache.put(keys.DHCP_MAC_ALIAS, this.clientAlias);
            },
            handleGotoConnections(address) {
                const target = this.addressFromBound(address);
                if (target) this.$router.replace({
                    path: "/home/connection", query: { searchText: target }
                }).catch(() => {});
            },
            async handleStartDHCPServer() {
                if (this.starting) return;
                if (!this.serverRunning) {
                    this.isShowConfigView = true;
                    return;
                }
                await dhcpService.stop();
                this.server = null;
                this.clients = [];
                this.boundState = {};
            },
            dhcpPolicy() {
                const hijackDns = (this.currentProfilePayload?.tun?.["dns-hijack"] || []).flatMap(value => {
                    const [host, port] = String(value).split(":");
                    return port === undefined || port === "53" ? [host === "any" ? "8.8.8.8" : host] : [];
                }).slice(0, 2);
                return { hijackAddresses: this.routerHijackMacAddresses || [], hijackDns };
            },
            updateDhcpPolicy() {
                if (this.serverRunning) dhcpService.updatePolicy(this.dhcpPolicy()).catch(() => {});
            },
            async handleConfigConfirm(config) {
                if (this.starting || this.server) return;
                this.isShowConfigView = false;
                this.starting = true;
                try {
                    await dhcpService.start({ config, ...this.dhcpPolicy() }, (type, value) => {
                        if (type === "message" && !this.clients.some(item => item.chaddr === value.chaddr)) this.clients = [...this.clients, value];
                        if (type === "bound") this.boundState = value;
                        if (type === "close") { this.server = null; this.clients = []; this.boundState = {}; }
                    });
                    this.server = true;
                } catch {
                    this.server = null;
                    await this.$alert({ title: "DHCP", message: "DHCP service is unavailable" });
                } finally { this.starting = false; }
            },
            handleMacToHijack(address) {
                this.setRouterHijackMacAddresses({
                    addresses: this.routerHijackMacAddresses.includes(address)
                        ? this.routerHijackMacAddresses.filter(value => value !== address)
                        : [...this.routerHijackMacAddresses, address]
                });
            },
            addressFromBound(address) { return this.boundState[address]?.address || ""; }
        }
    }, function renderRouterPage() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        return createElement("div", { staticClass: "main-router-view" }, [
            createElement("div", { staticClass: "header" }, [
                createElement("div", [viewModel._v(labels.dhcpServer())]),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "btn",
                    class: [viewModel.serverRunning ? "btn-stop" : "btn-start"],
                    on: { click: viewModel.handleStartDHCPServer }
                }, [viewModel._v(`\n      ${viewModel._s(viewModel.buttonText)}\n    `)])
            ]),
            viewModel._v(" "),
            createElement("div", { staticClass: "list" }, viewModel._l(viewModel.clients, client => createElement("div", {
                key: client.chaddr,
                staticClass: "item",
                attrs: { title: client.chaddr }
            }, [
                createElement("div", { staticClass: "left" }, [
                    createElement("div", { staticClass: "name clickable" }, [
                        createElement("input", {
                            attrs: { type: "text" },
                            domProps: { value: viewModel.clientName(client) },
                            on: { change: event => viewModel.handleClientRename(event, client.chaddr) }
                        })
                    ]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "ip" }, [
                        viewModel._v(viewModel._s(viewModel.addressFromBound(client.chaddr) || "--"))
                    ])
                ]),
                viewModel._v(" "),
                createElement("div", { staticClass: "right" }, [
                    viewModel.routerHijackMacAddresses.includes(client.options[61])
                        ? createElement("div", {
                            staticClass: "btn",
                            on: { click: () => viewModel.handleGotoConnections(client.chaddr) }
                        }, [viewModel._v("\n         连接\n        ")])
                        : viewModel._e(),
                    viewModel._v(" "),
                    createElement("div", {
                        staticClass: "btn hijack-button",
                        on: { click: () => viewModel.handleMacToHijack(client.options[61]) }
                    }, [viewModel._v(`\n          ${viewModel._s(
                        viewModel.routerHijackMacAddresses.includes(client.options[61])
                            ? "Clash TUN"
                            : labels.defaultGateway()
                    )}\n        `)])
                ])
            ])), 0),
            viewModel._v(" "),
            viewModel.isShowConfigView ? createElement("config-view", {
                on: {
                    close: () => { viewModel.isShowConfigView = false; },
                    confirm: viewModel.handleConfigConfirm
                }
            }) : viewModel._e()
        ], 1);
    }, "74ff0369");

    return RouterPage;
}

module.exports = { createRouterPage };
