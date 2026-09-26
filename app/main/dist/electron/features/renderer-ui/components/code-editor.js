"use strict";

const { defineComponent } = require("../component");

function createCodeEditor({
    yaml,
    monaco,
    Vuex,
    hintComponent,
    platform,
    utilities,
    escCaptureComponent,
    navigatorComponent,
    editorLanguages,
    Language,
    modifyState
} = {}) {
    const options = {
        name: "CodeView",
        props: [],
        components: {
            Hint: hintComponent,
            EscCapture: escCaptureComponent,
            Navigator: navigatorComponent
        },
        data() {
            return {
                editor: null,
                isShow: false,
                resolve: null,
                reject: null,
                language: "",
                code: "",
                originCode: "",
                error: null,
                readOnly: false,
                fontSize: 13,
                isSelecting: false
            };
        },
        watch: {
            isShow(isVisible) {
                if (isVisible) return;
                if (this.editor) this.editor.dispose();
                this.editor = null;
            }
        },
        computed: {
            ...Vuex.mapState({}),
            ...Vuex.mapGetters(["theme"]),
            saveHint() {
                const labels = new Language(modifyState.language);
                return platform.isMacOS() ? "Command+S" : `${labels.save()}(Ctrl+S)`;
            },
            topKeys() {
                return this.code.split("\n").reduce((keys, line, index) => {
                    const match = line.match(/^(?!\s|-)(.+):(\s|$)/);
                    if (match?.[1]) keys.push({ key: match[1], index });
                    return keys;
                }, []);
            },
            topKeyNames() {
                return this.topKeys.map(entry => entry.key);
            }
        },
        methods: {
            show({ code, language = "yaml", readOnly = false, fontSize = 13 }) {
                const labels = new Language(modifyState.language);
                this.isShow = true;
                this.language = language;
                this.readOnly = readOnly;
                this.error = "";
                this.code = code;
                this.originCode = code;
                this.fontSize = fontSize || 13;
                this.$nextTick(() => {
                    this.editor = monaco.editor.create(this.$refs.editor, {
                        value: code,
                        language,
                        theme: "vs-dark",
                        fontFamily: "Consolas, Monaco, Lucida Console, Liberation Mono,\n        DejaVu Sans Mono, Bitstream Vera Sans Mono, Courier New, monospace",
                        fontSize: this.fontSize,
                        automaticLayout: true,
                        readOnly,
                        minimap: { enabled: false },
                        links: false,
                        contextmenu: false,
                        scrollbar: {
                            verticalScrollbarSize: 12,
                            horizontalScrollbarSize: 12
                        },
                        quickSuggestions: { other: true, strings: true },
                        smoothScrolling: true
                    });
                    this.editor.onDidChangeModelContent(() => {
                        this.code = this.editor.getValue();
                    });
                    this.editor.addAction({
                        id: "save",
                        label: labels.save(),
                        run: () => this.save(),
                        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS]
                    });
                    this.editor.setSelection(new monaco.Selection(1, 1, 1, 1));
                    this.editor.setScrollTop(editorLanguages.getScrollPosition(utilities.hashText(this.code)));
                    this.editor.onDidChangeCursorSelection(() => {
                        this.isSelecting = !this.editor.getSelection().isEmpty();
                    });
                    this.editor.focus();
                });
                return new Promise((resolve, reject) => {
                    this.resolve = resolve;
                    this.reject = reject;
                });
            },
            handleSaveClick() {
                this.save();
            },
            async handleAbortClick() {
                const labels = new Language(modifyState.language);
                if (this.code === this.originCode) {
                    this.cancel();
                    return;
                }

                const { response } = await utilities.showMessageBox({
                    type: "warning",
                    message: labels.askSaveChange(),
                    buttons: [labels.save(), labels.dontSave(), labels.cancel()]
                });
                if (response === 0) this.save();
                else if (response === 1) this.cancel();
            },
            saveScrollTop() {
                editorLanguages.saveScrollPosition(
                    utilities.hashText(this.code),
                    this.editor.getScrollTop()
                );
            },
            save() {
                if (!this.resolve) return;
                try {
                    if (this.language === "yaml") {
                        yaml.parse(this.code, { prettyErrors: true, strict: false });
                    }
                    this.resolve({ code: this.code });
                    this.saveScrollTop();
                    this.isShow = false;
                } catch (error) {
                    this.error = `Error: ${error.message}`;
                }
            },
            cancel() {
                this.reject();
                this.saveScrollTop();
                this.isShow = false;
            },
            handleNavigate(index) {
                const lineIndex = this.topKeys[index].index;
                this.editor.setScrollPosition({
                    scrollTop: this.editor.getTopForLineNumber(lineIndex + 1)
                }, 0);
            }
        },
        mounted() {},
        beforeDestroy() {}
    };

    return defineComponent(options, function renderCodeEditor() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = new Language(modifyState.language);
        if (!viewModel.isShow) return viewModel._e();

        return createElement("EscCapture", {
            staticClass: "main-code-view line-numbers bg-[color:var(--mask-c)]",
            on: {
                esc: viewModel.handleAbortClick,
                mousedown: event => event.target !== event.currentTarget
                    ? null
                    : viewModel.handleAbortClick(event)
            }
        }, [createElement("div", { staticClass: "card" }, [
            createElement("div", { ref: "editor", staticClass: "editor" }),
            viewModel._v(" "),
            viewModel.isSelecting ? viewModel._e() : createElement("navigator", {
                staticClass: "navigator",
                attrs: { list: viewModel.topKeyNames },
                on: { select: viewModel.handleNavigate }
            }),
            viewModel._v(" "),
            viewModel.error ? createElement("div", { staticClass: "error" }, [
                createElement("div", [viewModel._v(viewModel._s(viewModel.error))]),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "clickable",
                    on: { click: () => { viewModel.error = ""; } }
                }, [createElement("span", {
                    staticClass: "icon text-[20px] text-white"
                }, [viewModel._v("close")])])
            ]) : viewModel._e(),
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
                viewModel.readOnly ? viewModel._e() : createElement("Hint", {
                    staticClass: "save-btn clickable",
                    attrs: { hint: viewModel.saveHint },
                    on: { click: viewModel.handleSaveClick }
                }, [createElement("span", {
                    staticClass: "icon text-[20px] text-white"
                }, [viewModel._v("save")])])
            ], 1)
        ], 1)]);
    }, "35f836ea");
}

module.exports = { createCodeEditor };
