"use strict";

const { defineComponent } = require("../component");

function createDiffEditor({
    monaco,
    escCaptureComponent,
    hintComponent,
    platform,
    utilities,
    preferenceKeys,
    cache,
    Language,
    modifyState
} = {}) {
    const options = {
        components: {
            Hint: hintComponent,
            EscCapture: escCaptureComponent
        },
        name: "DiffView",
        props: {},
        data() {
            return {
                isShow: false,
                editor: null,
                resolve: null,
                reject: null,
                changeModel: null,
                baseModel: null,
                originalChangeCode: "",
                renderSideBySide: false
            };
        },
        watch: {
            isShow(isVisible) {
                if (isVisible) return;
                if (this.editor) this.editor.dispose();
                this.editor = null;
            },
            renderSideBySide(isEnabled) {
                if (this.editor) this.editor.updateOptions({ renderSideBySide: isEnabled });
                cache.put(preferenceKeys.IS_DIFF_EIDTOR_SEPARATED, isEnabled);
            }
        },
        computed: {
            saveHint() {
                const labels = new Language(modifyState.language);
                return platform.isMacOS() ? "Command+S" : `${labels.save()}(Ctrl+S)`;
            }
        },
        methods: {
            show({ base, change }) {
                const labels = new Language(modifyState.language);
                this.isShow = true;
                this.renderSideBySide = cache.get(preferenceKeys.IS_DIFF_EIDTOR_SEPARATED);
                this.originalChangeCode = change;
                this.baseModel = monaco.editor.createModel(base, "yaml");
                this.changeModel = monaco.editor.createModel(change, "yaml");
                this.$nextTick(() => {
                    this.editor = monaco.editor.createDiffEditor(this.$refs.editor, {
                        language: "yaml",
                        theme: "vs-dark",
                        fontFamily: "Consolas, Monaco, Lucida Console, Liberation Mono,\n        DejaVu Sans Mono, Bitstream Vera Sans Mono, Courier New, monospace",
                        fontSize: 12,
                        automaticLayout: true,
                        renderSideBySide: this.renderSideBySide,
                        minimap: { enabled: false },
                        links: false,
                        contextmenu: false,
                        scrollbar: {
                            verticalScrollbarSize: 12,
                            horizontalScrollbarSize: 12
                        },
                        quickSuggestions: { other: true, strings: true }
                    });
                    this.editor.addAction({
                        id: "save",
                        label: labels.save(),
                        run: this.handleSave,
                        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS]
                    });
                    this.editor.setModel({
                        original: this.baseModel,
                        modified: this.changeModel
                    });
                });
                return new Promise((resolve, reject) => {
                    this.resolve = resolve;
                    this.reject = reject;
                });
            },
            async handleCancel() {
                const labels = new Language(modifyState.language);
                if (this.changeModel.getValue() === this.originalChangeCode) {
                    this.reject();
                    this.isShow = false;
                    return;
                }

                const { response } = await utilities.showMessageBox({
                    type: "warning",
                    message: labels.askSaveChange(),
                    buttons: [labels.save(), labels.dontSave(), labels.cancel()]
                });
                if (response === 0) {
                    this.handleSave();
                } else if (response === 1) {
                    this.reject();
                    this.isShow = false;
                }
            },
            handleSave() {
                this.resolve(this.changeModel.getValue());
                this.isShow = false;
            },
            handleChangeStyle() {
                this.renderSideBySide = !this.renderSideBySide;
            }
        },
        mounted() {}
    };

    return defineComponent(options, function renderDiffEditor() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = new Language(modifyState.language);
        if (!viewModel.isShow) return viewModel._e();

        return createElement("esc-capture", {
            staticClass: "main-diff-view bg-[color:var(--mask-c)]",
            on: {
                esc: viewModel.handleCancel,
                mousedown: event => event.target !== event.currentTarget
                    ? null
                    : viewModel.handleCancel(event)
            }
        }, [createElement("div", { staticClass: "card" }, [
            createElement("div", { ref: "editor", staticClass: "editor" }),
            viewModel._v(" "),
            createElement("div", { staticClass: "btns" }, [
                createElement("Hint", {
                    staticClass: "change-btn-off clickable",
                    class: { "change-btn-on": viewModel.renderSideBySide },
                    attrs: { hint: "并排模式" },
                    on: { click: viewModel.handleChangeStyle }
                }, [createElement("span", {
                    staticClass: "icon text-[20px] text-white"
                }, [viewModel._v("compare")])]),
                viewModel._v(" "),
                createElement("Hint", {
                    staticClass: "abort-btn clickable",
                    attrs: { hint: `${labels.quit()}(ESC)` },
                    on: { click: viewModel.handleCancel }
                }, [createElement("span", {
                    staticClass: "icon text-[20px] text-white"
                }, [viewModel._v("close")])]),
                viewModel._v(" "),
                createElement("Hint", {
                    staticClass: "save-btn clickable",
                    attrs: { hint: viewModel.saveHint },
                    on: { click: viewModel.handleSave }
                }, [createElement("span", {
                    staticClass: "icon text-[20px] text-white"
                }, [viewModel._v("save")])])
            ], 1)
        ])]);
    }, "c878e8f6");
}

module.exports = { createDiffEditor };
