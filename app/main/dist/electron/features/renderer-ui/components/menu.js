"use strict";

const { defineComponent } = require("../component");

function createMenu({ escCaptureComponent, Language, modifyState } = {}) {
    const options = {
        name: "MenuView",
        props: [],
        components: { EscCapture: escCaptureComponent },
        data() {
            return {
                isShow: false,
                options: {},
                items: [],
                contentStyles: {},
                isScrollBottom: true
            };
        },
        watch: {
            isShow(isVisible) {
                this.$nextTick(() => {
                    if (!isVisible || !this.$refs.menu || !this.$refs.window.$el) return;

                    const menuElement = this.$refs.menu;
                    const windowElement = this.$refs.window.$el;
                    const availableHeight = windowElement.clientHeight + 25;
                    const { clientX, clientY } = this.options;
                    const styles = {};

                    if (clientY + menuElement.clientHeight <= availableHeight - 10) {
                        styles.top = `${clientY}px`;
                    } else if (clientY - menuElement.clientHeight >= 10) {
                        styles.top = `${clientY - menuElement.clientHeight}px`;
                    } else {
                        styles.top = `${clientY}px`;
                        styles.height = `${availableHeight - clientY - 10}px`;
                        this.isScrollBottom = false;
                    }
                    styles.left = clientX + menuElement.clientWidth <= windowElement.clientWidth
                        ? `${clientX}px`
                        : `${clientX - menuElement.clientWidth}px`;
                    this.contentStyles = styles;
                });
            }
        },
        computed: {},
        methods: {
            show(items = [], options = {}) {
                this.items = items;
                this.options = options;
                this.isShow = true;
                this.contentStyles = {};
                this.isScrollBottom = true;
            },
            handleCancel() {
                this.isShow = false;
            },
            handleItemSelect(item) {
                this.isShow = false;
                if (item) item.click();
            },
            handleMenuScroll(event) {
                const menuElement = event.target;
                this.isScrollBottom = menuElement.scrollTop + menuElement.clientHeight >= menuElement.scrollHeight - 20;
            }
        }
    };

    return defineComponent(options, function renderMenu() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = new Language(modifyState.language);
        if (!viewModel.isShow) return viewModel._e();

        return createElement("EscCapture", {
            ref: "window",
            staticClass: "main-menu-view-plugin",
            on: { esc: viewModel.handleCancel, mousedown: viewModel.handleCancel }
        }, [createElement("div", {
            staticClass: "card-main",
            on: { mousedown: event => event.stopPropagation() }
        }, [createElement("div", {
            ref: "menu",
            staticClass: "card-content",
            style: viewModel.contentStyles,
            on: { scroll: viewModel.handleMenuScroll }
        }, [
            viewModel._l(viewModel.items, item => [
                item.disabled
                    ? createElement("div", { key: item.text, staticClass: "item-disabled" }, [
                        createElement("div", [viewModel._v(viewModel._s(item.text))])
                    ])
                    : item.hide
                        ? viewModel._e()
                        : createElement("div", {
                            key: item.text,
                            staticClass: "item clickable",
                            on: { click: () => viewModel.handleItemSelect(item) }
                        }, [
                            createElement("span", { staticClass: "icon text-white mr-[15px] text-sm" }, [viewModel._v(viewModel._s(item.icon))]),
                            viewModel._v(" "),
                            createElement("div", [viewModel._v(viewModel._s(item.text))])
                        ])
            ]),
            viewModel._v(" "),
            viewModel.isScrollBottom ? viewModel._e() : createElement("div", {
                staticClass: "indicator bg-[#6f6f6f] text-white"
            }, [
                createElement("span", { staticClass: "text-xs" }, [viewModel._v(labels.scrollViewMore())]),
                createElement("span", { staticClass: "icon text-white" }, [viewModel._v("arrow_drop_down")])
            ])
        ], 2)])]);
    }, "00ec68dc");
}

module.exports = { createMenu };
