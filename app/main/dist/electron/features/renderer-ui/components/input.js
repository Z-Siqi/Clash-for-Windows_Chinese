"use strict";

const { defineComponent } = require("../component");

function createInput({ Vuex, escCaptureComponent, Language, modifyState } = {}) {
    const labels = new Language(modifyState.language);
    const options = {
        components: { EscCapture: escCaptureComponent },
        name: "InputView",
        props: [],
        data() {
            return {
                data: [],
                isShow: false,
                error: "",
                title: "",
                hint: "",
                resolve: null,
                reject: null,
                confirmText: labels.ok()
            };
        },
        watch: {},
        computed: {
            ...Vuex.mapGetters(["theme"])
        },
        methods: {
            show({ data = [], title = "", hint = "", confirmText = labels.ok() }) {
                this.error = "";
                this.isShow = true;
                this.data = data;
                this.title = title;
                this.hint = hint;
                this.confirmText = confirmText;
                this.$nextTick(() => {
                    for (const index in data) {
                        const textarea = this.$refs[`ta${index}`][0];
                        textarea.style.height = `${textarea.scrollHeight + 2}px`;
                    }
                });
                return new Promise((resolve, reject) => {
                    this.resolve = resolve;
                    this.reject = reject;
                });
            },
            handleTextareaInput(event) {
                const textarea = event.target;
                if (!textarea) return;
                textarea.style.height = "";
                textarea.style.height = `${textarea.scrollHeight + 2}px`;
            },
            handleKeyDown() {},
            handleCancel() {
                this.isShow = false;
                this.reject();
            },
            handleDone() {
                const missingRequiredValue = this.data.some(item => item.required && item.value === "");
                if (missingRequiredValue) {
                    this.error = "required key(*) must have a value";
                    return;
                }

                const invalidItem = this.data.find(item => (
                    Object.prototype.hasOwnProperty.call(item, "validate")
                    && item.validate(item.value) !== ""
                ));
                if (invalidItem) {
                    this.error = invalidItem.validate(invalidItem.value);
                    return;
                }

                this.isShow = false;
                const values = {};
                this.data.forEach(item => {
                    if (item.value !== "") values[item.key] = item.value;
                });
                this.resolve(values);
            }
        }
    };

    return defineComponent(options, function renderInput() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        if (!viewModel.isShow) return viewModel._e();

        return createElement("EscCapture", {
            staticClass: "main-input-view-plugin bg-[color:var(--mask-c)]",
            class: [`theme-${viewModel.theme}`],
            on: {
                esc: viewModel.handleCancel,
                keydown: viewModel.handleKeyDown,
                mousedown: viewModel.handleCancel
            }
        }, [createElement("div", {
            staticClass: "card-main bg-[color:var(--bgc)] text-[color:var(--fgc)]",
            on: { mousedown: event => event.stopPropagation() }
        }, [createElement("div", { staticClass: "card-content" }, [
            createElement("div", { staticClass: "content-title" }, [viewModel._v(viewModel._s(viewModel.title))]),
            viewModel._v(" "),
            viewModel.hint
                ? createElement("div", { staticClass: "content-hint" }, [viewModel._v(viewModel._s(viewModel.hint))])
                : viewModel._e(),
            viewModel._v(" "),
            createElement("div", { staticClass: "content-items" }, viewModel._l(viewModel.data, (item, index) => createElement("div", {
                key: index,
                staticClass: "content-item"
            }, [
                createElement("div", { staticClass: "item-key" }, [
                    viewModel._v(`\n            ${viewModel._s(item.name)}\n            `),
                    item.required ? createElement("span", [viewModel._v("*")]) : viewModel._e()
                ]),
                viewModel._v(" "),
                createElement("textarea", {
                    directives: [{ name: "model", rawName: "v-model", value: item.value, expression: "item.value" }],
                    ref: `ta${index}`,
                    refInFor: true,
                    staticClass: "border-[1px] border-[color:var(--bc)]",
                    attrs: {
                        type: "text",
                        rows: "1",
                        spellcheck: "false",
                        placeholder: item.placeholder
                    },
                    domProps: { value: item.value },
                    on: {
                        input: [
                            event => {
                                if (!event.target.composing) viewModel.$set(item, "value", event.target.value);
                            },
                            viewModel.handleTextareaInput
                        ]
                    }
                })
            ])), 0),
            viewModel._v(" "),
            viewModel.error
                ? createElement("div", { staticClass: "error-hint" }, [viewModel._v(viewModel._s(viewModel.error))])
                : viewModel._e(),
            viewModel._v(" "),
            createElement("div", { staticClass: "card-btns" }, [
                createElement("div", { staticClass: "btn btn-cancel", on: { click: viewModel.handleCancel } }, [viewModel._v(labels.cancel())]),
                viewModel._v(" "),
                createElement("div", { staticClass: "btn btn-ok", on: { click: viewModel.handleDone } }, [viewModel._v(viewModel._s(viewModel.confirmText))])
            ])
        ])])]);
    }, "15034054");
}

module.exports = { createInput };
