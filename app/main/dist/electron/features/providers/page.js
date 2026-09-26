"use strict";

function createProvidersPage({
    defineComponent,
    Vuex,
    getLanguage,
    moment,
    connectedStatus,
    electron,
    fs,
    path,
    Hint,
    AbortController = globalThis.AbortController
}) {
    const Button = defineComponent({
        props: { text: String, size: String, isLoading: Boolean },
        methods: {
            handleClick() { if (!this.isLoading) this.$emit("click"); }
        }
    }, function renderButton() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const loadingBox = delayClass => createElement("div", {
            class: ["box", delayClass, viewModel.size === "large" ? "large" : "small"]
        });
        return createElement("div", {
            staticClass: "main-button-view",
            on: { click: viewModel.handleClick }
        }, [viewModel.isLoading ? createElement("div", { staticClass: "line" }, [
            loadingBox("animation-delay1"),
            viewModel._v(" "),
            loadingBox("animation-delay2"),
            viewModel._v(" "),
            loadingBox("animation-delay3"),
            viewModel._v(" "),
            loadingBox("animation-delay4"),
            viewModel._v(" "),
            loadingBox("animation-delay5")
        ]) : createElement("div", [viewModel._v(viewModel._s(viewModel.text))])]);
    }, "f3b3ccf8");

    const ProvidersPage = defineComponent({
        components: { Button, Hint },
        data() {
            return {
                providers: [],
                ruleProviders: [],
                updateAbortCtl: new AbortController(),
                healthCheckAbortCtl: new AbortController(),
                errorProviderIndexes: []
            };
        },
        watch: {
            clashStatus(value) { if (value === connectedStatus) this.fetchData(); },
            profileRefreshTimes() { this.fetchData(); },
            allProviders(value) {
                this.errorProviderIndexes = value.reduce((result, provider, index) => {
                    if (provider.message !== "") result.push(index);
                    return result;
                }, []);
            }
        },
        computed: {
            ...Vuex.mapState({
                clashPath: state => state.app.clashPath,
                clashStatus: state => state.app.clashStatus,
                profileRefreshTimes: state => state.app.profileRefreshTimes,
                currentProfilePayload: state => state.app.currentProfilePayload,
                settings: state => state.app.settings
            }),
            ...Vuex.mapGetters(["clashAxiosClient"]),
            updatingProvidersCount() {
                return this.providers.filter(provider => provider.isUpdating).length
                    + this.ruleProviders.filter(provider => provider.isUpdating).length;
            },
            failedProvidersCount() {
                return this.allProviders.filter(provider => provider.message !== "").length;
            },
            checkingProvidersCount() {
                return this.providers.filter(provider => provider.isChecking).length;
            },
            allProviders() { return [...this.providers, ...this.ruleProviders]; }
        },
        methods: {
            fromNowString(value) {
                return moment(value).locale(getLanguage().locale()).fromNow();
            },
            handleLocateFailedProvider() {
                if (this.errorProviderIndexes.length === 0 || this.updatingProvidersCount !== 0) return;
                const index = this.errorProviderIndexes[0];
                this.$refs[`provider-${index}`]?.[0]?.scrollIntoView();
                this.errorProviderIndexes = [...this.errorProviderIndexes.slice(1), index];
            },
            handleAllProvidersUpdate() {
                if (this.updatingProvidersCount > 0) {
                    this.updateAbortCtl.abort();
                    this.updateAbortCtl = new AbortController();
                    return;
                }
                for (const index in this.providers) this.handleProviderUpdate(index);
                for (const index in this.ruleProviders) this.handleRuleProviderUpdate(index);
            },
            handleAllProvidersHealthCheck() {
                if (this.checkingProvidersCount > 0) {
                    this.healthCheckAbortCtl.abort();
                    this.healthCheckAbortCtl = new AbortController();
                    return;
                }
                for (const index in this.providers) this.handleHealthCheck(index);
            },
            async handleHealthCheck(index) {
                const provider = this.providers[index];
                if (!provider.name) return;
                this.$set(this.providers, index, { ...provider, isChecking: true });
                try {
                    await this.clashApi.healthCheckProxyProvider(provider.name, {
                        timeout: 0, signal: this.healthCheckAbortCtl.signal
                    });
                } catch (_error) {}
                this.$set(this.providers, index, { ...provider, isChecking: false });
            },
            async handleProviderUpdate(index) {
                const provider = this.providers[index];
                const { name, vehicleType, isUpdating } = provider;
                if (!["File", "HTTP"].includes(vehicleType) || !name || isUpdating) return;
                this.$set(this.providers, index, { ...provider, isUpdating: true, message: "" });
                try {
                    const { status, data } = await this.clashApi.updateProxyProvider(name, {
                        validateStatus: () => true, timeout: 0, signal: this.updateAbortCtl.signal
                    });
                    if (status === 204) {
                        const refreshed = await this.fetchSingleData("proxies", name) ?? provider;
                        this.$set(this.providers, index, { ...refreshed, isUpdating: false, message: "" });
                    } else {
                        this.$set(this.providers, index, {
                            ...provider, isUpdating: false,
                            message: data.message ?? getLanguage().couldNotUpdateProvider()
                        });
                    }
                } catch (error) {
                    this.$set(this.providers, index, { ...provider, isUpdating: false, message: error });
                }
            },
            async handleRuleProviderUpdate(index) {
                const provider = this.ruleProviders[index];
                const { name, vehicleType, isUpdating } = provider;
                if (!["File", "HTTP"].includes(vehicleType) || !name || isUpdating) return;
                this.$set(this.ruleProviders, index, { ...provider, isUpdating: true, message: "" });
                try {
                    const { status, data } = await this.clashApi.updateRuleProvider(name, {
                        validateStatus: () => true, timeout: 0, signal: this.updateAbortCtl.signal
                    });
                    if (status === 204) {
                        const refreshed = await this.fetchSingleData("rules", name) ?? provider;
                        this.$set(this.ruleProviders, index, { ...refreshed, isUpdating: false, message: "" });
                    } else {
                        this.$set(this.ruleProviders, index, {
                            ...provider, isUpdating: false,
                            message: data.message ?? getLanguage().couldNotUpdateProvider()
                        });
                    }
                } catch (error) {
                    this.$set(this.ruleProviders, index, { ...provider, isUpdating: false, message: error });
                }
            },
            handleEditProviderFile(type, provider) {
                const useEditor = this.settings.editProfileWithCFWEditor ?? false;
                const providers = {
                    rule: this.currentProfilePayload["rule-providers"] || {},
                    proxy: this.currentProfilePayload["proxy-providers"] || {}
                };
                const providerPath = (providers[type][provider.name] || {}).path;
                const open = async target => {
                    if (!useEditor) {
                        electron.shell.openPath(target);
                        return;
                    }
                    try {
                        const { code = "" } = await this.$code({
                            code: fs.readFileSync(target).toString(),
                            fontSize: this.settings.editorFontSize
                        });
                        fs.writeFileSync(target, code);
                    } catch (_error) {}
                };
                if (providerPath) open(path.isAbsolute(providerPath) ? providerPath : path.join(this.clashPath, providerPath));
            },
            async fetchSingleData(type, name) {
                const { status, data } = await this.clashApi.getProvider(type, name, {
                    validateStatus: () => true, timeout: 0, signal: this.updateAbortCtl.signal
                });
                return status === 200 ? data : null;
            },
            async fetchData() {
                const [proxyResponse, ruleResponse] = await Promise.all([
                    this.clashApi.getProxyProviders(), this.clashApi.getRuleProviders()
                ]);
                if (proxyResponse.status === 200) {
                    this.providers = Object.values(proxyResponse.data?.providers || {})
                        .map(provider => ({ ...provider, isChecking: false, isUpdating: false, message: "" }))
                        .filter(provider => ["HTTP", "File"].includes(provider.vehicleType));
                } else this.providers = [];
                if (ruleResponse.status === 200) {
                    this.ruleProviders = Object.values(ruleResponse.data?.providers || {})
                        .map(provider => ({ ...provider, isUpdating: false, message: "" }))
                        .filter(provider => ["HTTP", "File"].includes(provider.vehicleType));
                } else this.ruleProviders = [];
            }
        },
        beforeRouteEnter(_to, _from, next) {
            next(vm => {
                vm.fetchData();
                vm.updateAbortCtl = new AbortController();
                vm.healthCheckAbortCtl = new AbortController();
            });
        },
        beforeRouteLeave(_to, _from, next) {
            this.updateAbortCtl.abort();
            this.healthCheckAbortCtl.abort();
            next();
        }
    }, function renderProvidersPage() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const pluralSuffix = count => count === 1 ? "" : "s";
        const renderIconButton = ({ hint, icon, onClick, rotating = false }) => createElement("Hint", {
            staticClass: "icon-btn",
            attrs: { hint },
            on: { click: onClick }
        }, [createElement("span", {
            staticClass: "icon",
            class: { rotating }
        }, [viewModel._v(icon)])]);
        const renderProxyProvider = (provider, index) => createElement("div", {
                key: provider.name,
                ref: `provider-${index}`,
                refInFor: true,
                staticClass: "provider-item"
            }, [createElement("div", { staticClass: "provider-item-main" }, [
                createElement("div", [
                    createElement("div", { staticClass: "name-type" }, [
                        createElement("div", { staticClass: "name" }, [viewModel._v(viewModel._s(provider.name))])
                    ]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "update-hint" }, [
                        createElement("div", { staticClass: "type" }, [
                            viewModel._v(`\n                    ${viewModel._s(provider.vehicleType)} (${viewModel._s(provider.proxies.length)}\n                    Proxies) (${viewModel._s(viewModel.fromNowString(provider.updatedAt))})\n                  `)
                        ])
                    ]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "error-hint" }, [viewModel._v(viewModel._s(provider.message))])
                ]),
                viewModel._v(" "),
                createElement("div", { staticClass: "empty" }),
                viewModel._v(" "),
                renderIconButton({
                    hint: "Health check",
                    icon: "network_check",
                    onClick: () => viewModel.handleHealthCheck(index)
                }),
                viewModel._v(" "),
                renderIconButton({
                    hint: "Edit file",
                    icon: "code",
                    onClick: () => viewModel.handleEditProviderFile("proxy", provider)
                }),
                viewModel._v(" "),
                provider.vehicleType === "HTTP" ? renderIconButton({
                    hint: labels.updateProvider(),
                    icon: "refresh",
                    onClick: () => viewModel.handleProviderUpdate(index),
                    rotating: provider.isUpdating
                }) : viewModel._e()
            ], 1)]);
        const renderRuleProvider = (provider, index) => createElement("div", {
                key: provider.name,
                ref: `provider-${index + viewModel.providers.length}`,
                refInFor: true,
                staticClass: "provider-item"
            }, [createElement("div", { staticClass: "provider-item-main" }, [
                createElement("div", [
                    createElement("div", { staticClass: "name-type" }, [
                        createElement("div", { staticClass: "name" }, [
                            viewModel._v(`\n                    ${viewModel._s(provider.name)}\n                  `)
                        ])
                    ]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "update-hint" }, [
                        createElement("div", { staticClass: "type" }, [
                            viewModel._v(`\n                    ${viewModel._s(provider.vehicleType)}\n                    ${viewModel._s(provider.behavior)} (${viewModel._s(provider.ruleCount)} Rules)\n                    (${viewModel._s(viewModel.fromNowString(provider.updatedAt))})\n                  `)
                        ])
                    ]),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "error-hint" }, [viewModel._v(viewModel._s(provider.message))])
                ]),
                viewModel._v(" "),
                createElement("div", { staticClass: "empty" }),
                viewModel._v(" "),
                renderIconButton({
                    hint: "Edit file",
                    icon: "code",
                    onClick: () => viewModel.handleEditProviderFile("rule", provider)
                }),
                viewModel._v(" "),
                renderIconButton({
                    hint: labels.updateProvider(),
                    icon: "refresh",
                    onClick: () => viewModel.handleRuleProviderUpdate(index),
                    rotating: provider.isUpdating
                })
            ], 1)]);

        return createElement("div", { staticClass: "main-provider-view" }, [
            createElement("div", { class: ["card"] }, [
                createElement("div", { staticClass: "header" }, [
                    createElement("div", { staticClass: "buttons" }, [
                        createElement("Button", {
                            staticClass: "btn",
                            style: { backgroundColor: viewModel.updatingProvidersCount > 0 ? "#FF5F57" : "" },
                            attrs: {
                                text: viewModel.updatingProvidersCount > 0
                                    ? `Cancel ${viewModel.updatingProvidersCount} Update${pluralSuffix(viewModel.updatingProvidersCount)}`
                                    : labels.updateAll(),
                                isLoading: false
                            },
                            on: { click: viewModel.handleAllProvidersUpdate }
                        }),
                        viewModel._v(" "),
                        viewModel.providers.length > 0 ? createElement("Button", {
                            staticClass: "btn",
                            style: { backgroundColor: viewModel.checkingProvidersCount > 0 ? "#FF5F57" : "" },
                            attrs: {
                                text: viewModel.checkingProvidersCount > 0
                                    ? `Cancel ${viewModel.checkingProvidersCount} Check${pluralSuffix(viewModel.checkingProvidersCount)}`
                                    : labels.healthCheckAll(),
                                isLoading: false
                            },
                            on: { click: viewModel.handleAllProvidersHealthCheck }
                        }) : viewModel._e()
                    ], 1)
                ]),
                viewModel._v(" "),
                createElement("div", {
                    ref: "mixin-scroll-content",
                    staticClass: "content"
                }, [
                    viewModel.providers.length > 0 ? [
                        createElement("div", { staticClass: "title" }, [viewModel._v(labels.proxyProviders())]),
                        viewModel._v(" "),
                        createElement("div", { staticClass: "items" }, viewModel._l(
                            viewModel.providers,
                            renderProxyProvider
                        ), 0)
                    ] : viewModel._e(),
                    viewModel._v(" "),
                    viewModel.ruleProviders.length > 0 ? [
                        createElement("div", { staticClass: "title" }, [viewModel._v("Rule Providers")]),
                        viewModel._v(" "),
                        createElement("div", { staticClass: "items" }, viewModel._l(
                            viewModel.ruleProviders,
                            renderRuleProvider
                        ), 0)
                    ] : viewModel._e()
                ], 2),
                viewModel._v(" "),
                viewModel.failedProvidersCount > 0 ? createElement("div", {
                    staticClass: "fixed top-8 bg-opacity-80 right-2 bg-black px-3 py-1 text-white flex items-center gap-2 rounded text-sm clickable",
                    on: { click: viewModel.handleLocateFailedProvider }
                }, [
                    createElement("span", { staticClass: "icon text-sm text-red-500" }, [viewModel._v("error")]),
                    viewModel._v(`\n      ${viewModel._s(viewModel.failedProvidersCount)} error${viewModel._s(pluralSuffix(viewModel.failedProvidersCount))}\n    `)
                ]) : viewModel._e()
            ])
        ]);
    }, "3e34584d");

    return ProvidersPage;
}

module.exports = { createProvidersPage };
