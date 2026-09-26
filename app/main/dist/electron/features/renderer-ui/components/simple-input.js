"use strict";

const { defineComponent } = require("../component");

function createSimpleInput({ lodash } = {}) {
    const options = {
        name: "simple-input",
        props: {
            value: [String, Number],
            placeholder: String,
            suffix: String,
            type: {
                type: String,
                default() {
                    return "text";
                }
            }
        },
        model: { prop: "value", event: "change" },
        data() {
            return { suffixWidth: 0, ref: "" };
        },
        computed: {},
        methods: {
            handleTextChange: lodash.debounce(function handleTextChange(event) {
                const value = event.target?.value;
                if (value === undefined) return;
                this.$emit("change", this.type === "number" ? parseInt(value) : value);
            }, 500)
        },
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
                    placeholder: viewModel.placeholder
                },
                domProps: { value: viewModel.value },
                on: { input: viewModel.handleTextChange }
            }),
            viewModel._v(" "),
            createElement("div", { ref: viewModel.ref, staticClass: "suffix" }, [viewModel._v(viewModel._s(viewModel.suffix))])
        ]);
    }, "0f00486f");
}

module.exports = { createSimpleInput };
