"use strict";

const { defineComponent } = require("../component");

function createToggle() {
    const options = {
        props: { on: Boolean, loading: Boolean, disabled: Boolean, pendingOn: { type: Boolean, default: undefined } },
        model: { prop: "on", event: "change" },
        data() {
            return {};
        },
        watch: {},
        computed: {
            displayedOn() { return this.loading && typeof this.pendingOn === "boolean" ? this.pendingOn : this.on; }
        },
        methods: {
            handleClick() {
                if (this.disabled || this.loading) return;
                this.$emit("change", !this.on);
            }
        },
        mounted() {}
    };

    return defineComponent(options, function renderToggle() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", {
            staticClass: "main",
            class: { "cfw-toggle-pending": viewModel.loading },
            attrs: { role: "switch", "aria-checked": String(!!viewModel.on), "aria-busy": String(viewModel.loading), "aria-disabled": String(viewModel.disabled || viewModel.loading) },
            style: { cursor: viewModel.disabled || viewModel.loading ? "wait" : "pointer" },
            on: { click: viewModel.handleClick }
        }, [
            viewModel.loading ? createElement("span", {
                staticClass: "icon cfw-operation-spinner cfw-toggle-spinner", attrs: { "aria-hidden": "true" }
            }, [viewModel._v("autorenew")]) : viewModel._e(),
            createElement("transition", { attrs: { name: "move-right" } }, [
                viewModel.displayedOn ? viewModel._e() : createElement("div", { staticClass: "text" }, [
                    createElement("div", { staticClass: "base tint-right" }),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "base text-font text-off" })
                ])
            ]),
            viewModel._v(" "),
            createElement("transition", { attrs: { name: "move-left" } }, [
                viewModel.displayedOn ? createElement("div", { staticClass: "text" }, [
                    createElement("div", { staticClass: "base text-font text-on" }),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "base tint-left" })
                ]) : viewModel._e()
            ])
        ], 1);
    }, "37d0be30");
}

module.exports = { createToggle };
