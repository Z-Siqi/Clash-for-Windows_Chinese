"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(__dirname, "../../app/main/dist/electron/renderer.js");
let source = fs.readFileSync(rendererPath).toString("latin1").replace(/\r\n/g, "\n");

function replaceOnce(before, after, label) {
    const count = source.split(before).length - 1;
    if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
    source = source.replace(before, after);
}

replaceOnce(
    '}\nconst LANGUAGE = "language";',
    '    proxyCore() { return language(this.language, "Proxy Core", "\\u4ee3\\u7406\\u6838\\u5fc3") }\n'
    + '    proxyCoreDescribe() { return language(this.language, "Choose the compatible legacy Clash core or Mihomo for modern protocols such as AnyTLS. Changing the core restarts the proxy service.", "\\u9009\\u62e9\\u517c\\u5bb9\\u65e7\\u914d\\u7f6e\\u7684 Clash \\u6838\\u5fc3\\uff0c\\u6216\\u9009\\u62e9\\u652f\\u6301 AnyTLS \\u7b49\\u73b0\\u4ee3\\u534f\\u8bae\\u7684 Mihomo\\u3002\\u5207\\u6362\\u6838\\u5fc3\\u4f1a\\u91cd\\u542f\\u4ee3\\u7406\\u670d\\u52a1\\u3002") }\n'
    + '    legacyClashCore() { return language(this.language, "Clash (Legacy)", "Clash\\uff08\\u65e7\\u7248\\uff09") }\n'
    + '    mihomoCore() { return "Mihomo" }\n'
    + '}\nconst LANGUAGE = "language";',
    "language methods"
);

replaceOnce(
    'const { createClashApi } = require("./core/network/clash-api");',
    'const { createClashApi } = require("./core/network/clash-api");\n'
    + 'const { resolveCoreBinaryPath } = require("./core/clash-core/core-selection");\n'
    + 'const { buildProxyConfig } = require("./features/profiles/proxy-editor-config");',
    "module imports"
);

replaceOnce(
`                        clashBinaryPath: function(e, t) {
                            var i, n, o = (i = {}, l()(i, I.Ap, _().join(t.filesPath, "win", "ia32")), l()(i, I.J4, _().join(t.filesPath, "win", "x64")), l()(i, I.Vm, _().join(t.filesPath, "win", "arm64")), l()(i, I.Ml, _().join(t.filesPath, "darwin", "x64")), l()(i, I.UD, _().join(t.filesPath, "darwin", "arm64")), l()(i, I.bV, _().join(t.filesPath, "linux", "x64")), l()(i, I.tU, _().join(t.filesPath, "linux", "arm64")), i)[(0, I.$Q)()],
                                s = (n = {}, l()(n, I.Ap, "clash-win32.exe"), l()(n, I.J4, "clash-win64.exe"), l()(n, I.Vm, "clash-win-arm64.exe"), l()(n, I.Ml, "./clash-darwin"), l()(n, I.UD, "./clash-darwin"), l()(n, I.bV, "./clash-linux"), l()(n, I.tU, "./clash-linux"), n)[(0, I.$Q)()];
                            return _().join(o, s)
                        },`,
`                        clashBinaryPath: function(e, t) {
                            return resolveCoreBinaryPath({
                                path: _(),
                                filesPath: t.filesPath,
                                platform: process.platform,
                                arch: process.arch,
                                coreType: e.settings.proxyCore
                            })
                        },`,
    "core binary getter"
);

replaceOnce(
`                    methods: ee(ee(ee({}, (0, f.mapMutations)({
                        saveSettingsObject: "SAVE_SETTINGS_OBJECT",
                        setConfData: "SET_CONF_DATA"
                    })), (0, f.mapActions)(["getParserLogPath", "getScriptLogPath"])), {}, {
                        refreshCore: function() {`,
`                    methods: ee(ee(ee({}, (0, f.mapMutations)({
                        saveSettingsObject: "SAVE_SETTINGS_OBJECT",
                        setConfData: "SET_CONF_DATA"
                    })), (0, f.mapActions)(["getParserLogPath", "getScriptLogPath"])), {}, {
                        handleProxyCoreChange: function(index) {
                            var nextCore = 1 === index ? "mihomo" : "clash";
                            if (this.settings.proxyCore === nextCore) return;
                            this.$set(this.settings, "proxyCore", nextCore);
                            return this.refreshCore()
                        },
                        refreshCore: function() {`,
    "core selection handler"
);

replaceOnce(
`                    }, [t("div", {
                        staticClass: "item"
                    }, [t("div", {
                        staticClass: "flex items-center"
                    }, [t("div", [e._v(Lg.settingsEditor())])`,
`                    }, [t("div", {
                        staticClass: "item"
                    }, [t("div", {
                        staticClass: "flex items-center"
                    }, [t("div", [e._v(Lg.proxyCore())]), e._v(" "), t("Info", [e._v(Lg.proxyCoreDescribe())])], 1), e._v(" "), t("SelectView", {
                        attrs: {
                            items: [Lg.legacyClashCore(), Lg.mihomoCore()]
                        },
                        model: {
                            value: "mihomo" === e.settings.proxyCore ? 1 : 0,
                            callback: function(t) {
                                return e.handleProxyCoreChange(t)
                            },
                            expression: "settings.proxyCore"
                        }
                    })], 1), e._v(" "), t("div", {
                        staticClass: "item"
                    }, [t("div", {
                        staticClass: "flex items-center"
                    }, [t("div", [e._v(Lg.settingsEditor())])`,
    "settings core selector"
);

replaceOnce(
    '                            pType: ["ss", "vmess", "socks5", "http"],',
    '                            pType: ["ss", "vmess", "socks5", "http", "anytls"],',
    "AnyTLS type option"
);

replaceOnce(
`                            proxyWsPath: "",
                            proxyWsHeaders: ""`,
`                            proxyWsPath: "",
                            proxyWsHeaders: "",
                            proxyClientFingerprint: "chrome",
                            proxyUdp: true,
                            proxySni: "",
                            proxyAlpn: "h2,http/1.1",
                            proxyIdleSessionCheckInterval: 30,
                            proxyIdleSessionTimeout: 30,
                            proxyMinIdleSession: 0`,
    "AnyTLS editor state"
);

const proxyBuilderStart = `                                var t = {
                                    name: this.proxyName,
                                    type: this.proxyType,
                                    server: this.proxyServer,
                                    port: this.proxyPort
                                };
                                if ("ss" === this.proxyType) t.cipher = this.proxyChipher, t.password = this.proxyPassword, this.proxyObfs && (t.plugin = "obfs", t["plugin-opts"] = {
                                    mode: this.proxyObfs,
                                    host: this.proxyObfshost || "bing.com"
                                });
                                else if ("vmess" === this.proxyType) {
                                    if (t.uuid = this.proxyUuid, t.alterId = this.proxyAlterid, t.cipher = this.proxyChipher, this.proxyTls && (t.tls = !0), this.proxySkipCertVerify && (t["skip-cert-verify"] = !0), "ws" === this.proxyNetwork) {
                                        t.network = "ws";
                                        var i = {
                                            path: this.proxyWsPath
                                        };
                                        try {
                                            i = x(x({}, i), {}, {
                                                headers: JSON.parse(this.proxyWsHeaders)
                                            })
                                        } catch (e) {}
                                        t["ws-opts"] = i
                                    }
                                } else "socks5" !== this.proxyType && "http" !== this.proxyType || (this.proxyUsername && this.proxyPassword && (t.username = this.proxyUsername, t.password = this.proxyPassword), this.proxyTls && (t.tls = !0), this.proxySkipCertVerify && (t["skip-cert-verify"] = !0));`;
const proxyBuilderReplacement = `                                var t = buildProxyConfig({
                                    original: this.data,
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
                                });`;
replaceOnce(proxyBuilderStart, proxyBuilderReplacement, "proxy config builder");

replaceOnce(
`                                "username" in this.data && (this.proxyUsername = this.data.username)
                            }`,
`                                "username" in this.data && (this.proxyUsername = this.data.username), "client-fingerprint" in this.data && (this.proxyClientFingerprint = this.data["client-fingerprint"]), "udp" in this.data && (this.proxyUdp = this.data.udp), "sni" in this.data && (this.proxySni = this.data.sni), "alpn" in this.data && (this.proxyAlpn = Array.isArray(this.data.alpn) ? this.data.alpn.join(",") : this.data.alpn), "idle-session-check-interval" in this.data && (this.proxyIdleSessionCheckInterval = this.data["idle-session-check-interval"]), "idle-session-timeout" in this.data && (this.proxyIdleSessionTimeout = this.data["idle-session-timeout"]), "min-idle-session" in this.data && (this.proxyMinIdleSession = this.data["min-idle-session"])
                            }`,
    "load AnyTLS fields"
);

replaceOnce(
    '                    }), e._v(" "), "ss" === e.proxyType ? t("input", {',
    '                    }), e._v(" "), ["ss", "anytls"].includes(e.proxyType) ? t("input", {',
    "AnyTLS password input"
);

const anyTlsForm = ` : e._e(), e._v(" "), "anytls" === e.proxyType ? t("div", {
                        staticClass: "input-view"
                    }, [t("input", {
                        directives: [{ name: "model", rawName: "v-model", value: e.proxyClientFingerprint, expression: "proxyClientFingerprint" }],
                        attrs: { type: "text", placeholder: "Client fingerprint (for example: chrome)" },
                        domProps: { value: e.proxyClientFingerprint },
                        on: { input: function(t) { t.target.composing || (e.proxyClientFingerprint = t.target.value) } }
                    }), e._v(" "), t("input", {
                        directives: [{ name: "model", rawName: "v-model", value: e.proxySni, expression: "proxySni" }],
                        attrs: { type: "text", placeholder: "SNI" },
                        domProps: { value: e.proxySni },
                        on: { input: function(t) { t.target.composing || (e.proxySni = t.target.value) } }
                    }), e._v(" "), t("input", {
                        directives: [{ name: "model", rawName: "v-model", value: e.proxyAlpn, expression: "proxyAlpn" }],
                        attrs: { type: "text", placeholder: "ALPN (comma separated)" },
                        domProps: { value: e.proxyAlpn },
                        on: { input: function(t) { t.target.composing || (e.proxyAlpn = t.target.value) } }
                    }), e._v(" "), t("input", {
                        directives: [{ name: "model", rawName: "v-model", value: e.proxyIdleSessionCheckInterval, expression: "proxyIdleSessionCheckInterval" }],
                        attrs: { type: "number", placeholder: "Idle session check interval" },
                        domProps: { value: e.proxyIdleSessionCheckInterval },
                        on: { input: function(t) { t.target.composing || (e.proxyIdleSessionCheckInterval = t.target.value) } }
                    }), e._v(" "), t("input", {
                        directives: [{ name: "model", rawName: "v-model", value: e.proxyIdleSessionTimeout, expression: "proxyIdleSessionTimeout" }],
                        attrs: { type: "number", placeholder: "Idle session timeout" },
                        domProps: { value: e.proxyIdleSessionTimeout },
                        on: { input: function(t) { t.target.composing || (e.proxyIdleSessionTimeout = t.target.value) } }
                    }), e._v(" "), t("input", {
                        directives: [{ name: "model", rawName: "v-model", value: e.proxyMinIdleSession, expression: "proxyMinIdleSession" }],
                        attrs: { type: "number", placeholder: "Minimum idle sessions" },
                        domProps: { value: e.proxyMinIdleSession },
                        on: { input: function(t) { t.target.composing || (e.proxyMinIdleSession = t.target.value) } }
                    }), e._v(" "), t("label", [t("input", {
                        directives: [{ name: "model", rawName: "v-model", value: e.proxyUdp, expression: "proxyUdp" }],
                        attrs: { type: "checkbox" },
                        domProps: { checked: e.proxyUdp },
                        on: { change: function(t) { e.proxyUdp = t.target.checked } }
                    }), e._v(" UDP")]), e._v(" "), t("label", [t("input", {
                        directives: [{ name: "model", rawName: "v-model", value: e.proxySkipCertVerify, expression: "proxySkipCertVerify" }],
                        attrs: { type: "checkbox" },
                        domProps: { checked: e.proxySkipCertVerify },
                        on: { change: function(t) { e.proxySkipCertVerify = t.target.checked } }
                    }), e._v(" " + Lg.skipCertVerify())])]) : e._e()`;
replaceOnce(
    '                    }) : e._e(), e._v(" "), "vmess" === e.proxyType ? t("div", {',
    '                    })' + anyTlsForm + ', e._v(" "), "vmess" === e.proxyType ? t("div", {',
    "AnyTLS form"
);

replaceOnce(
    '["ss", "vmess", "http", "socks"].includes(i)',
    '["ss", "vmess", "http", "socks5", "anytls"].includes(i)',
    "editable proxy types"
);

replaceOnce(
    'case 52: //TODO: Support meta (/.config/clash -> /.config/mihomo)',
    'case 52: // Clash and Mihomo intentionally share the existing CFW home directory.',
    "shared core home directory comment"
);

fs.writeFileSync(rendererPath, Buffer.from(source, "latin1"));
console.log("Mihomo core selection and AnyTLS renderer support applied");
