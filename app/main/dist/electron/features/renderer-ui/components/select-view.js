"use strict";

const { defineComponent } = require("../component");

function createSelectView() {
    const options = {
        name: "SelectView",
        props: {
            items: Array,
            index: {
                type: Number,
                default() {
                    return 0;
                }
            }
        },
        model: { prop: "index", event: "select" },
        data() {
            return {};
        },
        computed: {},
        methods: {
            handleItemClick(index) {
                this.$emit("select", index);
            },
            itemClass(index) {
                const classes = ["item", `item-${index % 2 === 0 ? "double" : "single"}`];
                if (index === this.index) classes.push("item-selected");
                if (index === 0) classes.push("item-first");
                else if (index === this.items.length - 1) classes.push("item-last");
                return classes;
            }
        }
    };

    return defineComponent(options, function renderSelectView() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", { class: ["main-select-view"] }, viewModel._l(
            viewModel.items,
            (item, index) => createElement("div", {
                key: index,
                class: viewModel.itemClass(index),
                on: { click: () => viewModel.handleItemClick(index) }
            }, [viewModel._v(`\n    ${viewModel._s(item)}\n  `)])
        ), 0);
    }, "e458e7bc");
}

module.exports = { createSelectView };
