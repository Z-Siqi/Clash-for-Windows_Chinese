"use strict";

const { defineComponent } = require("../component");

function createSimpleInput({ lodash } = {}) {
    const options = {
        name: "simple-input",
        props: {
            value: [String, Number],
            placeholder: String,
            suffix: String,
            validate: Function,
            type: {
                type: String,
                default() {
                    return "text";
                }
            }
        },
        model: { prop: "value", event: "change" },
        data() {
            return { suffixWidth: 0, ref: "", validationError: "" };
        },
        computed: {},
        methods: {
            handleTextChange(event) {
                const value = event.target?.value;
                if (value === undefined || event.isComposing || event.target.composing) return;
                this.validationError = this.validate?.(value) || "";
                if (this.validationError) { this.emitTextChange.cancel?.(); return; }
                this.emitTextChange(this.type === "number" && value !== "" ? parseInt(value, 10) : value);
            },
            handleBlur() { this.emitTextChange.flush?.(); }
        },
        // Each input owns its timer; editing another field must not cancel it.
        created() { this.emitTextChange = lodash.debounce(value => this.$emit("change", value), 500); },
        beforeDestroy() { this.emitTextChange.flush?.(); this.emitTextChange.cancel?.(); },
        mounted() {
            this.ref = lodash.uniqueId("simple-input");
            this.$nextTick(() => {
                this.suffixWidth = this.$refs[this.ref].clientWidth;
            });
        }
    };

    return defineComponent(options, function renderSimpleInput() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", { staticClass: "main-simple-input" }, [
            createElement("input", {
                style: {
                    paddingLeft: "10px",
                    paddingRight: `${viewModel.suffixWidth + 10}px`
                },
                attrs: {
                    spellcheck: "false",
                    type: viewModel.type,
                    placeholder: viewModel.placeholder,
                    "aria-invalid": String(!!viewModel.validationError),
                    title: viewModel.validationError || undefined
                },
                domProps: { value: viewModel.value },
                on: { input: viewModel.handleTextChange, compositionend: viewModel.handleTextChange, blur: viewModel.handleBlur }
            }),
            viewModel.validationError ? createElement("span", { attrs: { role: "alert" }, staticClass: "text-red-500" }, [viewModel._v(viewModel.validationError)]) : viewModel._e(),
            viewModel._v(" "),
            createElement("div", { ref: viewModel.ref, staticClass: "suffix" }, [viewModel._v(viewModel._s(viewModel.suffix))])
        ]);
    }, "0f00486f");
}

module.exports = { createSimpleInput };
