"use strict";

const { defineComponent } = require("../component");

function createInfoIcon({ utilities, window, schedule = setTimeout, cancel = clearTimeout } = {}) {
    const options = {
        name: "info-icon",
        data() {
            return {
                isShowContent: false,
                timeoutID: null,
                contentPosition: { top: "-1000px", left: "-1000px" }
            };
        },
        computed: {},
        watch: {
            isShowContent(isVisible) {
                if (!isVisible) {
                    this.contentPosition = { top: "-1000px", left: "-1000px" };
                    return;
                }

                const iconBounds = this.$refs.icon.getBoundingClientRect();
                const contentElement = this.$refs.content;
                const fitsBelow = iconBounds.y + 20 + contentElement.offsetHeight < window.innerHeight;
                this.contentPosition = {
                    top: `${fitsBelow ? iconBounds.y : iconBounds.y + 20 - contentElement.offsetHeight}px`,
                    left: `${iconBounds.x + 20}px`
                };
            }
        },
        methods: {
            handleMouseEnter() {
                this.timeoutID = schedule(() => {
                    this.isShowContent = true;
                }, 500);
            },
            handleMouseLeave() {
                this.isShowContent = false;
                if (this.timeoutID) cancel(this.timeoutID);
            },
            handleContentClick(event) {
                const url = event.target?.href;
                if (url) utilities.confirmOpenExternal(url);
            }
        },
        mounted() {}
    };

    return defineComponent(options, function renderInfoIcon() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", {
            staticClass: "info-icon-main",
            on: {
                mouseenter: viewModel.handleMouseEnter,
                mouseleave: viewModel.handleMouseLeave
            }
        }, [
            createElement("div", {
                ref: "content",
                staticClass: "content",
                style: viewModel.contentPosition,
                on: { click: viewModel.handleContentClick }
            }, [viewModel._t("default")], 2),
            viewModel._v(" "),
            createElement("span", {
                ref: "icon",
                staticClass: "icon pr-1 text-base text-[color:var(--general-settings-icon-c)] opacity-70"
            }, [viewModel._v("info")])
        ]);
    }, "d4bbbea2");
}

module.exports = { createInfoIcon };
