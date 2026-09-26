"use strict";

const { defineComponent } = require("../component");

function createToggle() {
    const options = {
        props: ["on"],
        model: { prop: "on", event: "change" },
        data() {
            return {};
        },
        watch: {},
        computed: {},
        methods: {
            handleClick() {
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
            on: { click: viewModel.handleClick }
        }, [
            createElement("transition", { attrs: { name: "move-right" } }, [
                viewModel.on ? viewModel._e() : createElement("div", { staticClass: "text" }, [
                    createElement("div", { staticClass: "base tint-right" }),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "base text-font text-off" })
                ])
            ]),
            viewModel._v(" "),
            createElement("transition", { attrs: { name: "move-left" } }, [
                viewModel.on ? createElement("div", { staticClass: "text" }, [
                    createElement("div", { staticClass: "base text-font text-on" }),
                    viewModel._v(" "),
                    createElement("div", { staticClass: "base tint-left" })
                ]) : viewModel._e()
            ])
        ], 1);
    }, "37d0be30");
}

module.exports = { createToggle };
