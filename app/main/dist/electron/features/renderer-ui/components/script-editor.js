"use strict";

const { defineComponent } = require("../component");

const DEFAULT_TEST_SCRIPT = `def main(ctx, metadata):
  ip = ctx.resolve_ip(metadata["host"])
  if ip == "":
    return "DIRECT"
  region = ctx.geoip(ip)
  if region == 'CN':
    return "DIRECT"
  return "Proxy"`;

const SCRIPT_DOCUMENTATION_URL = "https://web.archive.org/web/20230521134903/dreamacro.github.io/clash/premium/script.html";

function createScriptEditor({
    monaco,
    Vuex,
    hintComponent,
    platform,
    utilities,
    escCaptureComponent,
    preferenceKeys,
    cache,
    selectViewComponent,
    electron,
    Language,
    modifyState
} = {}) {
    const options = {
        name: "ScriptView",
        props: [],
        components: {
            Hint: hintComponent,
            EscCapture: escCaptureComponent,
            SelectView: selectViewComponent
        },
        data() {
            return {
                editorCode: null,
                isShow: false,
                resolve: null,
                reject: null,
                metadata: {
                    type: 2,
                    network: 0,
                    host: "example.com",
                    sourceIP: "",
                    sourcePort: 7890,
                    destinationIP: "",
                    destinationPort: 443,
                    dnsMode: "normal",
                    processPath: "",
                    specialProxy: ""
                },
                isLoading: false
            };
        },
        watch: {
            isShow(isVisible) {
                if (isVisible) return;
                if (this.editorCode) this.editorCode.dispose();
                this.editorCode = null;
            }
        },
        computed: {
            ...Vuex.mapState({}),
            ...Vuex.mapGetters(["theme", "clashAxiosClient"]),
            saveHint() {
                const labels = new Language(modifyState.language);
                return platform.isMacOS() ? "Command+S" : `${labels.save()}(Ctrl+S)`;
            },
            mdt: {
                get() {
                    return this.metadata.type - 2;
                },
                set(index) {
                    this.metadata.type = index + 2;
                }
            },
            mdd: {
                get() {
                    return ["normal", "fake-ip", "redir-host"].indexOf(this.metadata.dnsMode);
                },
                set(index) {
                    this.metadata.dnsMode = ["normal", "fake-ip", "redir-host"][index];
                }
            }
        },
        methods: {
            show() {
                this.isShow = true;
                const editorOptions = {
                    theme: "vs-dark",
                    fontFamily: "Consolas, Monaco, Lucida Console, Liberation Mono,\n        DejaVu Sans Mono, Bitstream Vera Sans Mono, Courier New, monospace",
                    automaticLayout: true,
                    fontSize: 14,
                    minimap: { enabled: false },
                    links: false,
                    contextmenu: false,
                    scrollbar: {
                        verticalScrollbarSize: 12,
                        horizontalScrollbarSize: 12
                    },
                    quickSuggestions: { other: true, strings: true },
                    smoothScrolling: true
                };
                const script = cache.get(preferenceKeys.TEST_SCRIPT_CONTENT) || DEFAULT_TEST_SCRIPT;
                this.$nextTick(() => {
                    this.editorCode = monaco.editor.create(this.$refs["editor-code"], {
                        ...editorOptions,
                        value: script,
                        language: "python"
                    });
                    this.editorCode.addAction({
                        id: "test",
                        label: "Test",
                        run: () => this.test(),
                        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS]
                    });
                    this.editorCode.setSelection(new monaco.Selection(1, 1, 1, 1));
                    this.editorCode.focus();
                });
                return new Promise((resolve, reject) => {
                    this.resolve = resolve;
                    this.reject = reject;
                });
            },
            handleSaveClick() {
                this.test();
            },
            handleAbortClick() {
                this.cancel();
            },
            handleDocumentClick() {
                electron.shell.openExternal(SCRIPT_DOCUMENTATION_URL);
            },
            async test() {
                const labels = new Language(modifyState.language);
                const script = this.editorCode.getValue();
                cache.put(preferenceKeys.TEST_SCRIPT_CONTENT, script);
                if (!this.resolve) return;

                this.isLoading = true;
                try {
                    const { data } = await this.clashApi.runScript({
                        metadata: this.metadata,
                        script
                    });
                    utilities.showMessageBox({
                        type: "none",
                        message: `${labels.success()}, 结果: ${data.result}`
                    });
                } catch (error) {
                    utilities.showMessageBox({
                        type: "error",
                        message: labels.failWithError() + (
                            error.response?.data?.message
                            || error.response?.data
                            || error.message
                        )
                    });
                } finally {
                    this.isLoading = false;
                }
            },
            cancel() {
                this.reject();
                this.isShow = false;
            }
        },
        mounted() {},
        beforeDestroy() {}
    };

    return defineComponent(options, function renderScriptEditor() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = new Language(modifyState.language);
        if (!viewModel.isShow) return viewModel._e();

        const renderSelect = (items, value, onChange) => createElement("SelectView", {
            staticClass: "theme-dark",
            attrs: { items },
            model: { value, callback: onChange, expression: "" }
        });
        const renderInput = (label, key, type = "text") => createElement("div", [
            createElement("span", [viewModel._v(label)]),
            viewModel._v(" "),
            createElement("input", {
                directives: [{
                    name: "model",
                    rawName: "v-model",
                    value: viewModel.metadata[key],
                    expression: `metadata.${key}`
                }],
                attrs: { type },
                domProps: { value: viewModel.metadata[key] },
                on: {
                    input: event => {
                        if (!event.target.composing) viewModel.$set(viewModel.metadata, key, event.target.value);
                    }
                }
            })
        ]);

        return createElement("EscCapture", {
            staticClass: "main-script-view line-numbers bg-[color:var(--mask-c)]",
            on: {
                esc: viewModel.handleAbortClick,
                mousedown: event => event.target !== event.currentTarget
                    ? null
                    : viewModel.handleAbortClick(event)
            }
        }, [createElement("div", {
            staticClass: "card flex flex-col bg-[color:#1C1C1C] text-white"
        }, [
            createElement("div", { staticClass: "px-6 pt-3 text-lg" }, [viewModel._v(labels.scriptTest())]),
            viewModel._v(" "),
            createElement("div", {
                staticClass: "metadata pb-3 pt-2 px-6 flex-grow-0 h-fit gap-x-5 grid grid-cols-2 gap-1 text-sm"
            }, [
                createElement("div", { staticStyle: { "grid-column": "1 / -1" } }, [
                    createElement("span", [viewModel._v(labels.type())]),
                    viewModel._v(" "),
                    renderSelect(
                        ["HTTP", "HTTP Connect", "Socks4", "Socks5", "Redir", "TProxy", "TUN", "Tunnel"],
                        viewModel.mdt,
                        value => { viewModel.mdt = value; }
                    ),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "flex-grow" })
                ]),
                viewModel._v(" "),
                createElement("div", [
                    createElement("span", [viewModel._v(labels.network())]),
                    viewModel._v(" "),
                    renderSelect(["TCP", "UDP"], viewModel.metadata.network, value => {
                        viewModel.$set(viewModel.metadata, "network", value);
                    })
                ]),
                viewModel._v(" "),
                createElement("div", [
                    createElement("span", [viewModel._v(labels.modeDNS())]),
                    viewModel._v(" "),
                    renderSelect(["normal", "fake-ip", "redir-host"], viewModel.mdd, value => {
                        viewModel.mdd = value;
                    })
                ]),
                viewModel._v(" "),
                renderInput(labels.host(), "host"),
                viewModel._v(" "),
                renderInput(labels.sourceIP(), "sourceIP"),
                viewModel._v(" "),
                renderInput(labels.sourcePort(), "sourcePort", "number"),
                viewModel._v(" "),
                renderInput(labels.destinationIP(), "destinationIP"),
                viewModel._v(" "),
                renderInput(labels.destinationPort(), "destinationPort", "number"),
                viewModel._v(" "),
                renderInput(labels.processPath(), "processPath")
            ]),
            viewModel._v(" "),
            createElement("div", { ref: "editor-code", staticClass: "editor-code flex-grow-1" }),
            viewModel._v(" "),
            createElement("div", { staticClass: "btns" }, [
                createElement("Hint", {
                    staticClass: "abort-btn clickable",
                    attrs: { hint: labels.quit() },
                    on: { click: viewModel.handleAbortClick }
                }, [createElement("span", {
                    staticClass: "icon text-[20px] text-white"
                }, [viewModel._v("close")])]),
                viewModel._v(" "),
                createElement("Hint", {
                    staticClass: "bg-cyan-500 clickable",
                    attrs: { hint: labels.docs() },
                    on: { click: viewModel.handleDocumentClick }
                }, [createElement("span", {
                    staticClass: "icon text-[20px] text-white"
                }, [viewModel._v("article")])]),
                viewModel._v(" "),
                viewModel.isLoading ? createElement("Hint", {
                    staticClass: "bg-gray-500 clickable",
                    attrs: { hint: "Please wait" }
                }, [createElement("span", {
                    staticClass: "icon text-[20px] text-white"
                }, [viewModel._v("pending")])]) : createElement("Hint", {
                    staticClass: "save-btn clickable",
                    attrs: { hint: viewModel.saveHint },
                    on: { click: viewModel.handleSaveClick }
                }, [createElement("span", {
                    staticClass: "icon text-[20px] text-white"
                }, [viewModel._v("play_arrow")])])
            ], 1)
        ])]);
    }, "05227e49");
}

module.exports = { createScriptEditor };
