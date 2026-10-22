"use strict";

const { parsePort } = require("../../core/network/tcp-port");
const { supportsAnyTls } = require("../../core/clash-core/core-capabilities");
const { proxyNames, references, replaceReferences, removeReferences, invalidReferences, circularReferences } = require("./profile-references");

const GROUPS = "proxy-groups";
const PROXIES = "proxies";

function createProfileEditor({
    defineComponent,
    Vuex,
    getLanguage,
    buildProxyConfig,
    fs,
    profileFiles,
    path,
    yaml,
    draggable
}) {
    const AppendProxyView = defineComponent({
        props: ["type", "data", "coreType"],
        data() {
            return {
                ssCipher: ["aes-128-gcm", "aes-192-gcm", "aes-256-gcm", "chacha20-ietf-poly1305", "aes-128-ctr", "aes-192-ctr", "aes-256-ctr", "aes-128-cfb", "aes-192-cfb", "aes-256-cfb", "chacha20-ietf", "xchacha20", "rc4-md5", "xchacha20-ietf-poly1305"],
                vmessCipher: ["none", "auto", "aes-128-gcm", "chacha20-poly1305"],
                pType: ["ss", "vmess", "socks5", "http", "anytls"],
                gType: ["url-test", "fallback", "select", "load-balance"],
                vmessType: ["tcp", "ws"],
                groupName: "", groupType: "select", groupUrl: "https://www.gstatic.com/generate_204",
                groupInterval: 600, proxyType: "ss", proxyName: "", proxyServer: "", proxyPort: "",
                proxyChipher: "", proxyPassword: "", proxyUuid: "", proxyAlterid: "", proxyObfs: "",
                proxyObfshost: "", proxyTls: false, proxyUsername: "", alterIdx: -1,
                proxySkipCertVerify: false, proxyNetwork: "tcp", proxyWsPath: "", proxyWsHeaders: "",
                proxyClientFingerprint: "chrome", proxyUdp: true, proxySni: "", proxyAlpn: "h2,http/1.1",
                proxyIdleSessionCheckInterval: 30, proxyIdleSessionTimeout: 30, proxyMinIdleSession: 0,
                validationError: ""
            };
        },
        computed: {
            proxyTypes() { return this.pType.filter(type => type !== "anytls" || supportsAnyTls(this.coreType)); },
            protocolUnavailable() { return this.type === 1 && this.proxyType === "anytls" && !supportsAnyTls(this.coreType); }
        },
        methods: {
            confirmInput() {
                this.validationError = "";
                if (this.protocolUnavailable) { this.validationError = getLanguage().anyTlsRequiresMihomo(); return; }
                if (!String(this.type === 0 ? this.groupName : this.proxyName).trim()) {
                    this.validationError = getLanguage().requiredFieldMissing();
                    return;
                }
                if (this.type === 1 && parsePort(this.proxyPort) === null) {
                    this.validationError = getLanguage().invalidPort();
                    return;
                }
                if (this.type === 1 && this.proxyType === "vmess" && this.proxyNetwork === "ws" && this.proxyWsHeaders.trim()) {
                    try {
                        const headers = JSON.parse(this.proxyWsHeaders);
                        if (!headers || typeof headers !== "object" || Array.isArray(headers)) throw new Error("Invalid headers");
                    } catch (_invalidJson) {
                        this.validationError = getLanguage().invalidWebSocketHeaders();
                        return;
                    }
                }
                if (this.type === 0) {
                    const content = { ...(this.data || { proxies: [] }), name: this.groupName, type: this.groupType };
                    delete content._index;
                    if (["url-test", "fallback", "load-balance"].includes(this.groupType)) {
                        content.url = this.groupUrl;
                        content.interval = this.groupInterval;
                    }
                    this.$emit("inputDone", { type: 0, content, index: this.alterIdx });
                } else if (this.type === 1) {
                    const content = buildProxyConfig({
                        original: this.data,
                        initialValues: this.initialValues,
                        proxyType: this.proxyType,
                        proxyName: this.proxyName,
                        proxyServer: this.proxyServer,
                        proxyPort: this.proxyPort,
                        proxyChipher: this.proxyChipher,
                        proxyPassword: this.proxyPassword,
                        proxyUuid: this.proxyUuid,
                        proxyAlterid: this.proxyAlterid,
                        proxyObfs: this.proxyObfs,
                        proxyObfshost: this.proxyObfshost,
                        proxyTls: this.proxyTls,
                        proxyUsername: this.proxyUsername,
                        proxySkipCertVerify: this.proxySkipCertVerify,
                        proxyNetwork: this.proxyNetwork,
                        proxyWsPath: this.proxyWsPath,
                        proxyWsHeaders: this.proxyWsHeaders,
                        proxyClientFingerprint: this.proxyClientFingerprint,
                        proxyUdp: this.proxyUdp,
                        proxySni: this.proxySni,
                        proxyAlpn: this.proxyAlpn,
                        proxyIdleSessionCheckInterval: this.proxyIdleSessionCheckInterval,
                        proxyIdleSessionTimeout: this.proxyIdleSessionTimeout,
                        proxyMinIdleSession: this.proxyMinIdleSession
                    });
                    this.$emit("inputDone", { type: 1, content, index: this.alterIdx });
                }
            }
        },
        mounted() {
            if (!this.data) return;
            if (this.type === 0) {
                this.groupName = this.data.name;
                this.groupType = this.data.type;
                if ("url" in this.data) this.groupUrl = this.data.url;
                if ("interval" in this.data) this.groupInterval = this.data.interval;
            } else if (this.type === 1) {
                this.proxyName = this.data.name;
                this.proxyPort = this.data.port;
                this.proxyServer = this.data.server;
                this.proxyType = this.data.type;
                if ("password" in this.data) this.proxyPassword = this.data.password;
                if ("plugin" in this.data) {
                    const { mode, host } = this.data["plugin-opts"] || {};
                    this.proxyObfs = mode;
                    this.proxyObfshost = host;
                }
                if ("obfs-host" in this.data) this.proxyObfshost = this.data["obfs-host"];
                if ("tls" in this.data) this.proxyTls = this.data.tls;
                if ("cipher" in this.data) this.proxyChipher = this.data.cipher;
                if ("uuid" in this.data) this.proxyUuid = this.data.uuid;
                if ("alterId" in this.data) this.proxyAlterid = this.data.alterId;
                if ("skip-cert-verify" in this.data) this.proxySkipCertVerify = this.data["skip-cert-verify"];
                if ("network" in this.data) this.proxyNetwork = this.data.network;
                const ws = this.data["ws-opts"];
                if (ws) {
                    if ("path" in ws) this.proxyWsPath = ws.path;
                    try { if ("headers" in ws) this.proxyWsHeaders = JSON.stringify(ws.headers); } catch (_error) {}
                }
                if ("username" in this.data) this.proxyUsername = this.data.username;
                if ("client-fingerprint" in this.data) this.proxyClientFingerprint = this.data["client-fingerprint"];
                if ("udp" in this.data) this.proxyUdp = this.data.udp;
                if ("sni" in this.data) this.proxySni = this.data.sni;
                if ("alpn" in this.data) this.proxyAlpn = Array.isArray(this.data.alpn) ? this.data.alpn.join(",") : this.data.alpn;
                if ("idle-session-check-interval" in this.data) this.proxyIdleSessionCheckInterval = this.data["idle-session-check-interval"];
                if ("idle-session-timeout" in this.data) this.proxyIdleSessionTimeout = this.data["idle-session-timeout"];
                if ("min-idle-session" in this.data) this.proxyMinIdleSession = this.data["min-idle-session"];
            }
            this.alterIdx = this.data._index;
            this.initialValues = { ...this.$data };
        }
    }, function renderAppendProxyView() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const input = (field, attrs = {}) => createElement("input", {
            directives: [{ name: "model", rawName: "v-model", value: viewModel[field], expression: field }],
            attrs: { type: "text", ...attrs },
            domProps: { value: viewModel[field] },
            on: {
                input: event => {
                    if (!event.target.composing) viewModel[field] = event.target.value;
                }
            }
        });
        const radios = (items, field, className) => createElement("div", {
            staticClass: className
        }, viewModel._l(items, (item, index) => createElement("div", { key: index }, [
            createElement("input", {
                directives: [{ name: "model", rawName: "v-model", value: viewModel[field], expression: field }],
                attrs: { type: "radio", id: item },
                domProps: { value: item, checked: viewModel._q(viewModel[field], item) },
                on: { change: () => { viewModel[field] = item; } }
            }),
            viewModel._v(" "),
            createElement("label", { attrs: { for: item } }, [viewModel._v(viewModel._s(item))])
        ])), 0);
        const checkbox = (field, id, text) => createElement("div", [createElement("input", {
            directives: [{ name: "model", rawName: "v-model", value: viewModel[field], expression: field }],
            attrs: { type: "checkbox", id },
            domProps: {
                checked: Array.isArray(viewModel[field])
                    ? viewModel._i(viewModel[field], null) > -1
                    : viewModel[field]
            },
            on: { change: event => {
                const value = viewModel[field];
                const target = event.target;
                const checked = Boolean(target.checked);
                if (Array.isArray(value)) {
                    const index = viewModel._i(value, null);
                    if (target.checked && index < 0) viewModel[field] = value.concat([null]);
                    else if (!target.checked && index > -1) {
                        viewModel[field] = value.slice(0, index).concat(value.slice(index + 1));
                    }
                } else {
                    viewModel[field] = checked;
                }
            } }
        }), viewModel._v(" "), createElement("label", { attrs: { for: id } }, [viewModel._v(text)])]);
        const groupForm = createElement("div", { staticClass: "input-view" }, [
            createElement("div", { staticClass: "title" }, [
                viewModel._v(viewModel.data ? labels.editProxyGroupTitle() : labels.newProxyGroupTitle())
            ]),
            viewModel._v(" "),
            input("groupName", { placeholder: labels.proxyGroupName() }),
            viewModel._v(" "),
            radios(viewModel.gType, "groupType", "group-type-list"),
            viewModel._v(" "),
            viewModel.groupType !== "select"
                ? input("groupUrl", { placeholder: "URL" })
                : viewModel._e(),
            viewModel._v(" "),
            viewModel.groupType !== "select"
                ? input("groupInterval", { placeholder: labels.intervalSeconds() })
                : viewModel._e()
        ]);
        const anyTlsOptions = createElement("div", { staticClass: "input-view" }, [
            input("proxyClientFingerprint", { placeholder: labels.clientFingerprintPlaceholder() }),
            viewModel._v(" "),
            input("proxySni", { placeholder: "SNI" }),
            viewModel._v(" "),
            input("proxyAlpn", { placeholder: labels.alpnPlaceholder() }),
            viewModel._v(" "),
            input("proxyIdleSessionCheckInterval", { type: "number", placeholder: labels.idleSessionCheckInterval() }),
            viewModel._v(" "),
            input("proxyIdleSessionTimeout", { type: "number", placeholder: labels.idleSessionTimeout() }),
            viewModel._v(" "),
            input("proxyMinIdleSession", { type: "number", placeholder: labels.minimumIdleSessions() }),
            viewModel._v(" "),
            createElement("label", [createElement("input", {
                directives: [{ name: "model", rawName: "v-model", value: viewModel.proxyUdp, expression: "proxyUdp" }],
                attrs: { type: "checkbox" },
                domProps: { checked: viewModel.proxyUdp },
                on: { change: event => { viewModel.proxyUdp = event.target.checked; } }
            }), viewModel._v(" UDP")]),
            viewModel._v(" "),
            createElement("label", [createElement("input", {
                directives: [{
                    name: "model",
                    rawName: "v-model",
                    value: viewModel.proxySkipCertVerify,
                    expression: "proxySkipCertVerify"
                }],
                attrs: { type: "checkbox" },
                domProps: { checked: viewModel.proxySkipCertVerify },
                on: { change: event => { viewModel.proxySkipCertVerify = event.target.checked; } }
            }), viewModel._v(` ${labels.skipCertVerify()}`)])
        ]);
        const proxyForm = createElement("div", { staticClass: "input-view" }, [
            createElement("div", { staticClass: "title" }, [
                viewModel._v(viewModel.data ? labels.editProxyTitle() : labels.newProxyTitle())
            ]),
            viewModel._v(" "),
            input("proxyName", { placeholder: labels.proxyName() }),
            viewModel._v(" "),
            radios(viewModel.proxyTypes, "proxyType", "proxy-type-list"),
            viewModel._v(" "),
            input("proxyServer", { placeholder: labels.server() }),
            viewModel._v(" "),
            input("proxyPort", { placeholder: labels.port() }),
            viewModel._v(" "),
            ["ss", "anytls"].includes(viewModel.proxyType)
                ? input("proxyPassword", { placeholder: labels.password() })
                : viewModel._e(),
            viewModel._v(" "),
            viewModel.proxyType === "anytls" ? anyTlsOptions : viewModel._e(),
            viewModel._v(" "),
            viewModel.proxyType === "vmess"
                ? radios(viewModel.vmessCipher, "proxyChipher", "cipher-list")
                : viewModel.proxyType === "ss"
                    ? radios(viewModel.ssCipher, "proxyChipher", "cipher-list")
                    : viewModel._e(),
            viewModel._v(" "),
            viewModel.proxyType === "ss" ? createElement("div", { staticClass: "ss-list" }, [
                input("proxyObfs", { placeholder: labels.obfsPlaceholder(), readonly: !!(viewModel.data?.plugin && viewModel.data.plugin !== "obfs") }),
                viewModel._v(" "),
                input("proxyObfshost", { placeholder: labels.obfsHostPlaceholder(), readonly: !!(viewModel.data?.plugin && viewModel.data.plugin !== "obfs") })
            ]) : viewModel._e(),
            viewModel._v(" "),
            viewModel.proxyType === "vmess" ? createElement("div", { staticClass: "vmess-list" }, [
                input("proxyUuid", { placeholder: "UUID" }),
                viewModel._v(" "),
                input("proxyAlterid", { placeholder: "AlterId" }),
                viewModel._v(" "),
                radios(viewModel.vmessType, "proxyNetwork", "cipher-list")
            ]) : viewModel._e(),
            viewModel._v(" "),
            ["http", "socks5"].includes(viewModel.proxyType) ? createElement("div", {
                staticClass: "input-view"
            }, [
                input("proxyUsername", { placeholder: labels.optionalUsername() }),
                viewModel._v(" "),
                input("proxyPassword", { placeholder: labels.optionalPassword() })
            ]) : viewModel._e(),
            viewModel._v(" "),
            viewModel.proxyType === "vmess" && viewModel.proxyNetwork === "ws"
                ? input("proxyWsPath", { placeholder: labels.webSocketPath() })
                : viewModel._e(),
            viewModel._v(" "),
            viewModel.proxyType === "vmess" && viewModel.proxyNetwork === "ws"
                ? input("proxyWsHeaders", { placeholder: labels.webSocketHeaders() })
                : viewModel._e(),
            viewModel._v(" "),
            ["vmess", "socks5", "http"].includes(viewModel.proxyType) ? createElement("div", [
                checkbox("proxyTls", "vmess-tls", "TLS"),
                viewModel._v(" "),
                checkbox("proxySkipCertVerify", "vmess-skip-cert-verify", labels.skipCertVerify())
            ]) : viewModel._e()
        ]);

        return createElement("div", {
            staticClass: "main",
            attrs: { id: "main-append-proxy-view" }
        }, [
            viewModel.type === 0 ? groupForm : viewModel.type === 1 ? proxyForm : viewModel._e(),
            viewModel.validationError ? createElement("div", { staticClass: "text-red-500", attrs: { role: "alert" } }, [viewModel._v(viewModel.validationError)]) : viewModel._e(),
            viewModel._v(" "),
            createElement("div", {
            staticClass: "btns"
        }, [createElement("div", {
            staticClass: "btn cancel",
            on: { click: () => viewModel.$emit("inputCancel") }
        }, [viewModel._v(labels.cancel())]), viewModel._v(" "), createElement("div", {
            staticClass: "btn confirm",
            on: { click: viewModel.confirmInput }
        }, [viewModel._v(labels.ok())])])
        ]);
    }, "f638b328");

    const ProfileEditor = defineComponent({
        props: ["profileName"],
        components: { draggable, AppendProxyView },
        data() {
            return {
                conf: null,
                specialProxies: [{ name: "DIRECT" }, { name: "REJECT" }],
                addType: -1,
                addData: null,
                removedNames: [],
                referenceBusy: false
            };
        },
        computed: {
            saveBtn() { return getLanguage().save(); },
            ...Vuex.mapState({
                clashPath: state => state.app.clashPath,
                proxyCore: state => state.app.settings?.proxyCore,
                profilesPath: state => state.app.profilesPath
            })
        },
        methods: {
            proxy2group(proxy) { return proxy.name; },
            removeFromGroup(group, index) { this.conf[GROUPS][group].proxies.splice(index, 1); },
            removeFromProxies(event, index) {
                event.stopPropagation();
                return this.removeObject(PROXIES, index);
            },
            removeGroup(event, index) {
                event.stopPropagation();
                return this.removeObject(GROUPS, index);
            },
            async removeObject(kind, index) {
                if (this.referenceBusy) return false;
                const object = this.conf[kind]?.[index];
                if (!object) return false;
                const affected = references(this.conf).filter(item => item.target === object.name);
                this.referenceBusy = true;
                try {
                    let cleanReferences = false;
                    if (affected.length) {
                        const labels = getLanguage();
                        const message = `${labels.profileDeleteReferences({ name: object.name })}\n${affected.map(item => item.path).join("\n")}`;
                        const [choice] = await this.$select({ title: labels.delete(), message, bounded: true,
                            items: [labels.cancel(), labels.profileReplaceAndDelete(), labels.profileDeleteWithReferences(), labels.profileDeleteKeepReferences()] });
                        if (choice === 1) {
                            const targets = proxyNames(this.conf, this.proxyCore).filter(name => name !== object.name);
                            const [action, target] = await this.$select({ title: labels.profileReplacementTarget(),
                                choiceTitle: labels.profileReplacementTarget(), choiceItems: targets,
                                items: [labels.cancel(), labels.profileReplaceAndDelete()] });
                            if (action !== 1 || !Number.isInteger(target) || !targets[target]) return false;
                            const preview = JSON.parse(JSON.stringify(this.conf));
                            replaceReferences(preview, object.name, targets[target]);
                            preview[kind].splice(index, 1);
                            const cycles = circularReferences(preview);
                            if (cycles.length) {
                                await this.$alert({ content: `${labels.profileReferenceCycle()}\n${cycles.join("\n")}` });
                                return false;
                            }
                            replaceReferences(this.conf, object.name, targets[target]);
                        } else if (choice === 2) cleanReferences = true;
                        else if (choice !== 3) return false;
                    }
                    this.removedNames.push(object.name);
                    this.conf[kind].splice(this.conf[kind].indexOf(object), 1);
                    if (cleanReferences) {
                        this.removedNames.push(...removeReferences(this.conf, object.name));
                        this.conf = { ...this.conf };
                    }
                    return true;
                } catch (_cancelled) { return false; }
                finally { this.referenceBusy = false; }
            },
            renameGroup(from, to) {
                replaceReferences(this.conf, from, to);
            },
            renameRule(from, to) {
                replaceReferences(this.conf, from, to);
            },
            handleInputDone(result) {
                if (!result?.content) return false;
                const collection = result.type === 0 ? GROUPS : PROXIES;
                const names = [...(this.conf[GROUPS] || []), ...(this.conf[PROXIES] || [])];
                const old = this.conf[collection]?.[result.index];
                if (names.some(item => item !== old && item.name === result.content.name)
                    || ["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE", "GLOBAL"].includes(result.content.name)) {
                    this.$alert({ content: getLanguage().profileDuplicateName({ name: result.content.name }) }).catch(() => {});
                    return false;
                }
                this.addType = -1;
                if (result.type === 0) {
                    if (result.index === -1) {
                        if (!this.conf[GROUPS]) this.$set(this.conf, GROUPS, []);
                        this.conf[GROUPS].push(result.content);
                    }
                    else {
                        const proxies = this.conf[GROUPS][result.index].proxies;
                        const oldName = this.conf[GROUPS][result.index].name;
                        if (proxies) result.content.proxies = proxies;
                        this.conf[GROUPS].splice(result.index, 1, result.content);
                        this.renameGroup(oldName, result.content.name);
                    }
                } else if (result.type === 1) {
                    if (result.index === -1) {
                        if (!this.conf[PROXIES]) this.$set(this.conf, PROXIES, []);
                        this.conf[PROXIES].push(result.content);
                    }
                    else {
                        const oldName = this.conf[PROXIES][result.index].name;
                        this.conf[PROXIES].splice(result.index, 1, result.content);
                        this.renameGroup(oldName, result.content.name);
                    }
                }
            },
            newGroup() { this.addType = 0; this.addData = null; },
            editGroup(group, index) {
                if (["url-test", "fallback", "select", "load-balance"].includes(group.type)) {
                    this.addType = 0; this.addData = { ...group, _index: index };
                } else this.$alert({ content: `${getLanguage().couldNotEditProxyGroupType()} [${group.type}].` });
            },
            newProxy() { this.addType = 1; this.addData = null; },
            editProxy(proxy, index) {
                if (["ss", "vmess", "http", "socks5", "anytls"].includes(proxy.type)) {
                    this.addType = 1; this.addData = { ...proxy, _index: index };
                } else this.$alert({ content: `${getLanguage().cannotEditProxyType()} [${proxy.type}].` });
            },
            async loadData() {
                try {
                    const content = profileFiles ? await profileFiles.readProfile(this.profilesPath, this.profileName)
                        : fs.readFileSync(path.join(this.profilesPath, this.profileName), "utf8");
                    this.conf = yaml.parse(content);
                } catch (_error) {}
            },
            async saveData() {
                if (!this.conf || this.referenceBusy) return;
                const missing = invalidReferences(this.conf, this.removedNames, this.proxyCore);
                if (missing.length) {
                    await this.$alert({ title: getLanguage().failed(), content: `${getLanguage().profileUnresolvedReferences()}\n${missing.map(item => `${item.path}: ${item.target}`).join("\n")}` });
                    return false;
                }
                const cycles = circularReferences(this.conf);
                if (cycles.length) {
                    await this.$alert({ content: `${getLanguage().profileReferenceCycle()}\n${cycles.join("\n")}` });
                    return false;
                }
                try {
                    if (profileFiles) await profileFiles.writeProfile(this.profilesPath, this.profileName, yaml.stringify(this.conf));
                    else fs.writeFileSync(path.join(this.profilesPath, this.profileName), yaml.stringify(this.conf));
                    this.$emit("done");
                } catch (_error) { this.$emit("error"); }
            }
        },
        mounted() { this.loadData(); }
    }, function renderProfileEditor() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const dragAttrs = {
            group: { name: "people", pull: "clone", put: false, revertClone: true },
            clone: viewModel.proxy2group,
            delay: 300,
            animation: 200,
            "delay-on-touch-only": true
        };
        const renderSourceItem = (item, index, edit, remove) => createElement("div", {
            key: index,
            staticClass: "proxy-item left-item",
            on: { click: () => edit(item, index) }
        }, [
            createElement("div", [viewModel._v(viewModel._s(item.name))]),
            viewModel._v(" "),
            createElement("span", {
                staticClass: "icon text-white",
                on: { click: event => remove(event, index) }
            }, [viewModel._v("delete")])
        ]);
        const renderSectionTitle = (title, onAdd) => createElement("div", {
            staticClass: "section-title"
        }, [
            createElement("h2", [viewModel._v(title)]),
            viewModel._v(" "),
            createElement("div", {
                staticClass: "add-icon",
                on: { click: onAdd }
            }, [viewModel._v(labels.add())])
        ]);

        return createElement("div", {
            staticClass: "main-config-view"
        }, [createElement("div", {
            staticClass: "floating"
        }, [createElement("div", {
            staticClass: "hint"
        }, [viewModel._v(labels.sortDescribe())]), viewModel._v(" "), createElement("div", {
            staticClass: "floating-right"
        }, [createElement("div", {
            staticClass: "main-btn save",
            on: { click: viewModel.saveData }
        }, [viewModel._v(viewModel._s(viewModel.saveBtn))]), viewModel._v(" "), createElement("div", {
            staticClass: "main-btn reload",
            on: { click: () => viewModel.$emit("cancel") }
        }, [viewModel._v(labels.cancel())])])]), viewModel._v(" "), viewModel.conf ? createElement("div", {
            staticClass: "drag"
        }, [createElement("div", {
            staticClass: "proxy"
        }, [createElement("div", {
            staticClass: "section-title"
        }, [createElement("h2", [viewModel._v(labels.specialProxies())])]), viewModel._v(" "), createElement("draggable", {
            staticClass: "dragArea", attrs: dragAttrs,
            model: {
                value: viewModel.specialProxies,
                callback: value => { viewModel.specialProxies = value; },
                expression: "specialProxies"
            }
        }, viewModel._l(viewModel.specialProxies, (proxy, index) => createElement("div", {
            key: index,
            staticClass: "proxy-item left-item"
        }, [viewModel._v(`\n          ${viewModel._s(proxy.name)}\n        `)])), 0),
        viewModel._v(" "),
        renderSectionTitle(labels.proxyGroups(), viewModel.newGroup),
        viewModel._v(" "),
        createElement("draggable", {
            staticClass: "dragArea", attrs: dragAttrs,
            model: {
                value: viewModel.conf[GROUPS],
                callback: value => viewModel.$set(viewModel.conf, GROUPS, value),
                expression: "conf['proxy-groups']"
            }
        }, viewModel._l(viewModel.conf[GROUPS], (group, index) => (
            renderSourceItem(group, index, viewModel.editGroup, viewModel.removeGroup)
        )), 0),
        viewModel._v(" "),
        renderSectionTitle(labels.proxies(), viewModel.newProxy),
        viewModel._v(" "),
        createElement("draggable", {
            staticClass: "dragArea", attrs: dragAttrs,
            model: {
                value: viewModel.conf.proxies,
                callback: value => viewModel.$set(viewModel.conf, PROXIES, value),
                expression: "conf['proxies']"
            }
        }, viewModel._l(viewModel.conf.proxies, (proxy, index) => (
            renderSourceItem(proxy, index, viewModel.editProxy, viewModel.removeFromProxies)
        )), 0)], 1), viewModel._v(" "), createElement("div", {
            staticClass: "proxy-group"
        }, viewModel._l(viewModel.conf[GROUPS], (group, groupIndex) => createElement("div", {
            key: groupIndex
        }, [createElement("div", {
                staticClass: "section-title"
            }, [createElement("h2", [viewModel._v(viewModel._s(group.name))]), viewModel._v(" "), createElement("div", {
                staticClass: "type-icon"
            }, [viewModel._v(`( ${viewModel._s(group.type)} )`)])]), viewModel._v(" "), createElement("draggable", {
                staticClass: "dragArea",
                attrs: { group: { name: "people" }, scroll: true, scrollSensitivity: 100, scrollSpeed: 50, delay: 300, animation: 200, "delay-on-touch-only": true },
                model: {
                    value: group.proxies,
                    callback: value => viewModel.$set(group, "proxies", value),
                    expression: "group.proxies"
                }
            }, viewModel._l(group.proxies, (proxyName, proxyIndex) => createElement("div", {
                key: proxyIndex,
                staticClass: "proxy-item right-item"
            }, [createElement("div", [viewModel._v(viewModel._s(proxyName))]), viewModel._v(" "), createElement("span", {
                    staticClass: "icon text-white",
                    on: { click: () => viewModel.removeFromGroup(groupIndex, proxyIndex) }
                }, [viewModel._v("delete")])])), 0)
            ], 1)), 0)
        ]) : viewModel._e(), viewModel._v(" "), viewModel.addType !== -1 ? createElement("append-proxy-view", {
            attrs: { data: viewModel.addData, type: viewModel.addType, "core-type": viewModel.proxyCore },
            on: {
                inputDone: viewModel.handleInputDone,
                inputCancel: () => { viewModel.addType = -1; }
            }
        }) : viewModel._e()], 1);
    }, "9e0b3cf4");

    return ProfileEditor;
}

module.exports = { createProfileEditor };
