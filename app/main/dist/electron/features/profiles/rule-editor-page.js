"use strict";

function createRuleEditor({
    defineComponent,
    Vuex,
    getLanguage,
    moment,
    yaml,
    fs,
    path,
    lodash,
    notify,
    cloneJson,
    schedule = setTimeout
}) {
    const colors = [];

    const RuleAlterView = defineComponent({
        props: ["profileName"],
        data() {
            return {
                ruleTypes: ["DOMAIN-SUFFIX", "DOMAIN", "DOMAIN-KEYWORD", "IP-CIDR", "SRC-IP-CIDR", "GEOIP", "PROCESS-NAME", "DST-PORT", "SRC-PORT", "MATCH"],
                selectedType: "", proxyGroups: [], selectedGroup: "", content: ""
            };
        },
        computed: {
            ...Vuex.mapState({ profilesPath: state => state.app.profilesPath }),
            ...Vuex.mapGetters(["clashAxiosClient"])
        },
        methods: {
            inputDone() {
                let value = null;
                if (this.selectedType === "MATCH" && this.selectedGroup) {
                    value = { type: this.selectedType, payload: "", proxy: this.selectedGroup };
                } else if (this.content && this.selectedType && this.selectedGroup) {
                    value = { type: this.selectedType, payload: this.content, proxy: this.selectedGroup };
                }
                this.$emit("done", value);
            },
            handleMaskClick() { this.$emit("close"); }
        },
        mounted() {
            try {
                const config = yaml.parse(fs.readFileSync(path.join(this.profilesPath, this.profileName)).toString());
                const proxies = config.proxies || [];
                const groups = config["proxy-groups"] || [];
                this.proxyGroups = [
                    "DIRECT", "REJECT", ...groups.map(group => group.name), ...proxies.map(proxy => proxy.name)
                ];
            } catch (_error) {}
        }
    }, function renderRuleAlterView() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        return createElement("div", {
            attrs: { type: "text/x-template", id: "modal-template" }
        }, [createElement("transition", {
            attrs: { name: "modal" }
        }, [createElement("div", {
            staticClass: "modal-mask",
            on: { mousedown: viewModel.handleMaskClick }
        }, [createElement("div", {
            staticClass: "modal-wrapper"
        }, [createElement("div", {
            staticClass: "modal-container",
            on: { mousedown(event) { event.stopPropagation(); } }
        }, [createElement("div", {
            staticClass: "model-title"
        }, [createElement("div", [viewModel._v(labels.createNewRule())]), viewModel._v(" "), createElement("div", {
            staticClass: "rule-floating-btns"
        }, [createElement("div", {
            staticClass: "rule-floating-ok",
            on: { click: viewModel.inputDone }
        }, [viewModel._v(labels.add())]), viewModel._v(" "), createElement("div", {
            staticClass: "rule-floating-cancel",
            on: { click() { return viewModel.$emit("close"); } }
        }, [viewModel._v("\n                " + labels.cancel() + "\n              ")])])]), viewModel._v(" "), createElement("div", {
            staticClass: "scroll-view"
        }, [viewModel.selectedType !== "MATCH" ? createElement("div", {
            staticClass: "rule-section-title"
        }, [viewModel._v("\n              " + labels.content() + "\n            ")]) : viewModel._e(), viewModel._v(" "), createElement("div", [viewModel.selectedType !== "MATCH" ? createElement("input", {
            directives: [{ name: "model", rawName: "v-model", value: viewModel.content, expression: "content" }],
            attrs: { placeholder: labels.eg() + "google.com", id: "rule-content", type: "text" },
            domProps: { value: viewModel.content },
            on: { input(event) { if (!event.target.composing) viewModel.content = event.target.value; } }
        }) : viewModel._e()]), viewModel._v(" "), createElement("div", {
            staticClass: "rule-section-title"
        }, [viewModel._v(labels.type())]), viewModel._v(" "), createElement("div", {
            staticClass: "rule-type-group"
        }, viewModel._l(viewModel.ruleTypes, (ruleType, index) => createElement("div", {
            key: index,
            class: { "rule-type-item": true, "rule-type-selected": ruleType === viewModel.selectedType },
            on: { click() { viewModel.selectedType = ruleType; } }
        }, [viewModel._v("\n                " + viewModel._s(ruleType) + "\n              ")])), 0), viewModel._v(" "), createElement("div", {
            staticClass: "rule-section-title"
        }, [viewModel._v(labels.proxyPolicy())]), viewModel._v(" "), createElement("div", {
            staticClass: "rule-proxy-group"
        }, viewModel._l(viewModel.proxyGroups, (proxyGroup, index) => createElement("div", {
            key: index,
            class: { "rule-proxy-item": true, "rule-proxy-selected": proxyGroup === viewModel.selectedGroup },
            on: { click() { viewModel.selectedGroup = proxyGroup; } }
        }, [viewModel._v("\n                " + viewModel._s(proxyGroup) + "\n              ")])), 0)])])])])])], 1);
    }, "eea841c4");

    const RuleEditor = defineComponent({
        props: ["profileName"],
        data() {
            return {
                listData: [], memoryData: [], showAlterModel: false,
                saveBtnText: getLanguage().save(), axiosSource: null,
                filterKeywords: "", providers: {}
            };
        },
        components: { RuleAlterView },
        computed: {
            ...Vuex.mapState({
                clashPath: state => state.app.clashPath,
                profiles: state => state.app.profiles,
                profilesPath: state => state.app.profilesPath
            }),
            ...Vuex.mapGetters(["clashAxiosClient"])
        },
        methods: {
            async handleRuleClick(rule) {
                if (rule.type !== "RULE-SET") return;
                try {
                    const response = await this.clashApi.updateRuleProvider(rule.payload);
                    if (response.status === 204) {
                        this.loadData();
                        notify("Success", `RULE-SET [${rule.payload}] has been updated!`);
                    } else notify("Failed", `RULE-SET [${rule.payload}] update failed(Server Error)!`);
                } catch (_error) {
                    notify("Failed", `RULE-SET [${rule.payload}] ${getLanguage().updateFailedNetErr()}`);
                }
            },
            fromNow(value) { return moment(value).locale(getLanguage().locale()).fromNow(); },
            providerOfPayload(payload) { return this.providers[payload] || null; },
            moveItem(top, item, index) {
                this.removeItem(item, index);
                if (top) this.memoryData.unshift(item);
                else this.memoryData.push(item);
                this.listData = this.memoryData.slice(0, 100);
            },
            randomBGC(type) {
                const existing = colors.find(value => value.type === type);
                if (existing) return { "background-color": `rgb(${existing.r},${existing.g},${existing.b})` };
                const value = {
                    type,
                    r: Math.floor(100 * Math.random() + 10),
                    g: Math.floor(100 * Math.random() + 10),
                    b: Math.floor(100 * Math.random() + 10)
                };
                colors.push(value);
                return { "background-color": `rgb(${value.r},${value.g},${value.b})` };
            },
            inputDone(value) {
                this.showAlterModel = false;
                if (value) { this.memoryData.unshift(value); this.listData.unshift(value); }
            },
            handleFilterKeywordInput: lodash.debounce(function(event) {
                if (!event.target) return;
                this.filterKeywords = event.target.value;
                this.loadData();
            }, 500),
            applyRules() {
                const labels = getLanguage();
                try {
                    const rules = cloneJson(this.memoryData).map(rule => {
                        const params = rule.params ?? "";
                        return rule.payload ? `${rule.type},${rule.payload},${rule.proxy}${params}`
                            : `${rule.type},${rule.proxy}`;
                    });
                    const target = path.join(this.profilesPath, this.profileName);
                    const config = yaml.parse(fs.readFileSync(target, "utf8"));
                    config.rules = rules;
                    fs.writeFileSync(target, yaml.stringify(config));
                    this.$emit("done");
                    this.saveBtnText = "Done";
                } catch (_error) {
                    this.$emit("error");
                    this.saveBtnText = "Fail";
                }
                schedule(() => { this.saveBtnText = labels.save(); }, 3000);
            },
            removeItem(item, index) {
                const memoryIndex = this.memoryData.findIndex(value => value.payload === item.payload
                    && value.proxy === item.proxy && value.type === item.type);
                if (memoryIndex > -1) {
                    this.memoryData.splice(memoryIndex, 1);
                    this.listData.splice(index, 1);
                }
            },
            async loadData() {
                const target = path.join(this.profilesPath, this.profileName);
                const source = fs.readFileSync(target, "utf8");
                try {
                    const [rulesResponse, providerResponse] = await Promise.all([
                        this.clashApi.getRules(), this.clashApi.getRuleProviders()
                    ]);
                    this.providers = (providerResponse.data || {}).providers || {};
                    const config = yaml.parse(source);
                    this.memoryData = config.rules.map(rule => {
                        const parts = rule.split(",");
                        if (parts.length === 2) return { type: parts[0].trim(), payload: "", proxy: parts[1].trim(), params: "" };
                        if (parts.length === 3) return { payload: parts[1].trim(), proxy: parts[2].trim(), type: parts[0].trim(), params: "" };
                        if (parts.length === 4) return { payload: parts[1].trim(), proxy: parts[2].trim(), type: parts[0].trim(), params: `,${parts[3]}` };
                        return null;
                    }).filter(Boolean);
                    if (this.filterKeywords !== "") {
                        const expression = new RegExp(this.filterKeywords.trim().split(/\s+/).join("|"), "i");
                        this.listData = this.memoryData.filter(rule => expression.test(rule.proxy)
                            || expression.test(rule.payload) || expression.test(rule.type)).slice(0, 100);
                    } else this.listData = this.memoryData.slice(0, 100);
                    void rulesResponse;
                } catch (_error) {}
            }
        },
        mounted() { this.loadData(); }
    }, function renderRuleEditor() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const renderRule = (rule, index) => {
            const provider = viewModel.providerOfPayload(rule.payload);
            return createElement("div", {
                key: index, staticClass: "log-item", attrs: { title: rule.payload },
                on: { click() { return viewModel.handleRuleClick(rule); } }
            }, [createElement("div", {
                staticClass: "left"
            }, [createElement("div", {
                class: ["url", provider ? "rule-set" : ""]
            }, [viewModel._v("\n          " + viewModel._s(rule.payload) + "\n        ")]), viewModel._v(" "), createElement("div", {
                staticClass: "rule"
            }, [viewModel._v("\n          " + viewModel._s(rule.type) + "\n          "), provider ? createElement("div", [viewModel._v("\n            Rules: " + viewModel._s(provider.ruleCount) + "\n          ")]) : viewModel._e(), viewModel._v(" "), provider ? createElement("div", [viewModel._v("\n            Last Updated:\n            " + viewModel._s(viewModel.fromNow(provider.updatedAt)) + "\n          ")]) : viewModel._e(), viewModel._v(" "), provider ? createElement("div", [viewModel._v("\n            " + viewModel._s(provider.vehicleType) + "\n            " + viewModel._s(provider.behavior) + "\n          ")]) : viewModel._e()])]), viewModel._v(" "), createElement("div", {
                staticClass: "right-main"
            }, [createElement("div", {
                staticClass: "right", style: viewModel.randomBGC(rule.proxy)
            }, [viewModel._v("\n          " + viewModel._s(rule.proxy) + "\n        ")]), viewModel._v(" "), createElement("span", {
                staticClass: "icon ctl-icon",
                on: { click(event) { event.stopPropagation(); return viewModel.moveItem(true, rule, index); } }
            }, [viewModel._v("north")]), viewModel._v(" "), createElement("span", {
                staticClass: "icon ctl-icon",
                on: { click(event) { event.stopPropagation(); return viewModel.moveItem(false, rule, index); } }
            }, [viewModel._v("south")]), viewModel._v(" "), createElement("span", {
                staticClass: "icon ctl-icon",
                on: { click(event) { event.stopPropagation(); return viewModel.removeItem(rule, index); } }
            }, [viewModel._v("delete")])])]);
        };

        return createElement("div", {
            attrs: { id: "main-log-view" }
        }, [createElement("div", {
            staticClass: "header"
        }, [createElement("div", {
            staticClass: "title"
        }, [viewModel._v(labels.topMatchRule() + "(" + viewModel._s(viewModel.memoryData.length) + ").")]), viewModel._v(" "), createElement("div", {
            staticClass: "header-btns"
        }, [createElement("div", {
            staticClass: "btn btn-add md-button",
            on: { click() { viewModel.showAlterModel = true; } }
        }, [viewModel._v("\n        " + labels.add() + "\n      ")]), viewModel._v(" "), createElement("div", {
            staticClass: "btn btn-save md-button",
            on: { click: viewModel.applyRules }
        }, [viewModel._v("\n        " + viewModel._s(viewModel.saveBtnText) + "\n      ")]), viewModel._v(" "), createElement("div", {
            staticClass: "btn btn-back md-button",
            on: { click() { return viewModel.$emit("cancel"); } }
        }, [viewModel._v("\n        " + labels.cancel() + "\n      ")])])]), viewModel._v(" "), createElement("div", {
            staticClass: "filter-view"
        }, [createElement("input", {
            directives: [{ name: "model", rawName: "v-model", value: viewModel.filterKeywords, expression: "filterKeywords" }],
            attrs: { type: "text", placeholder: labels.fiterByKeywords() },
            domProps: { value: viewModel.filterKeywords },
            on: {
                input: [function updateFilter(event) { if (!event.target.composing) viewModel.filterKeywords = event.target.value; }, function filterRules(event) { return viewModel.handleFilterKeywordInput(event); }]
            }
        })]), viewModel._v(" "), createElement("div", {
            staticClass: "log-list"
        }, viewModel._l(viewModel.listData, renderRule), 0), viewModel._v(" "), viewModel.showAlterModel ? createElement("rule-alter-view", {
            attrs: { "profile-name": viewModel.profileName },
            on: { close() { viewModel.showAlterModel = false; }, done: viewModel.inputDone }
        }) : viewModel._e()], 1);
    }, "459dde1e");

    return RuleEditor;
}

module.exports = { createRuleEditor };
