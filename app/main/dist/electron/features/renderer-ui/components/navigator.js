"use strict";

const { defineComponent } = require("../component");

function createNavigator({ lodash } = {}) {
    const options = {
        name: "Navigator",
        props: {
            list: { type: Array, required: true },
            index: { type: Number, default: -1 },
            width: { type: String, default: "100" },
            errorIndexes: {
                type: Array,
                default() {
                    return [];
                }
            }
        },
        data() {
            return { currentHoverIndex: -1 };
        },
        watch: {
            index: lodash.debounce(function scrollToSelectedIndex(index) {
                if (!this.isClosed || index < 0) return;
                const listElement = this.$refs.list;
                const itemElements = this.$refs.items;
                if (listElement && itemElements && itemElements.length > index) {
                    listElement.scrollTop = itemElements[index].offsetTop;
                }
            }, 500)
        },
        computed: {
            isClosed() {
                return this.currentHoverIndex === -1;
            },
            listStyle() {
                const width = this.width || "100";
                return this.isClosed ? {
                    opacity: 0.5,
                    alignItems: "center",
                    width: "20px",
                    backgroundColor: "transparent"
                } : {
                    opacity: 1,
                    width: `${width}px`,
                    right: "-10px",
                    transform: "translateX(-10px)",
                    borderLeftWidth: "1px"
                };
            }
        },
        methods: {
            handleHover(index) {
                this.currentHoverIndex = index;
            },
            itemClass(index) {
                if (this.errorIndexes.includes(index)) return ["item-error"];
                if (this.currentHoverIndex === index) return ["item-hover"];
                if (index === this.index) return ["item-selected"];
                return undefined;
            }
        },
        updated() {}
    };

    return defineComponent(options, function renderNavigator() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", {
            ref: "list",
            staticClass: "main-proxy-navigator",
            style: viewModel.listStyle,
            on: { mouseleave: () => { viewModel.currentHoverIndex = -1; } }
        }, viewModel._l(viewModel.list, (item, index) => createElement("div", {
            key: item,
            ref: "items",
            refInFor: true,
            staticClass: "clickable item",
            class: viewModel.itemClass(index),
            on: {
                mouseover: () => viewModel.handleHover(index),
                click: () => viewModel.$emit("select", index)
            }
        }, [viewModel._v(`\n    ${viewModel._s(viewModel.isClosed ? viewModel.$removeEmoji(item).trim()[0] : item)}\n  `)])), 0);
    }, "298f5540");
}

module.exports = { createNavigator };
