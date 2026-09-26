"use strict";

const { defineComponent } = require("../component");

function createHint({ schedule = setTimeout, cancel = clearTimeout } = {}) {
    const options = {
        name: "HintView",
        props: {
            hint: { type: String, required: true },
            position: {
                type: String,
                default: "top",
                validate(value) {
                    return ["top", "bottom", "left", "right"].includes(value);
                }
            }
        },
        data() {
            return { timeoutID: null, isShowHint: false };
        },
        computed: {},
        methods: {
            startCounting() {
                this.timeoutID = schedule(() => {
                    this.isShowHint = true;
                }, 1000);
            },
            stopCounting() {
                if (!this.timeoutID) return;
                cancel(this.timeoutID);
                this.timeoutID = null;
                this.isShowHint = false;
            }
        },
        updated() {
            this.$nextTick(() => {
                try {
                    const anchorBounds = this.$refs.hint.getBoundingClientRect();
                    const hintElement = this.$refs["hint-text"];
                    const hintBounds = hintElement?.getBoundingClientRect();
                    if (!hintBounds) return;

                    const centeredLeft = anchorBounds.x - hintBounds.width / 2 + anchorBounds.width / 2;
                    if (this.position === "top") {
                        hintElement.style.top = `${anchorBounds.y - hintBounds.height - 5}px`;
                        hintElement.style.left = `${centeredLeft}px`;
                    } else if (this.position === "bottom") {
                        hintElement.style.top = `${anchorBounds.y + anchorBounds.height + 5}px`;
                        hintElement.style.left = `${centeredLeft}px`;
                    } else if (this.position === "left") {
                        hintElement.style.top = `${anchorBounds.y - hintBounds.height / 2 + anchorBounds.height / 2}px`;
                        hintElement.style.left = `${anchorBounds.x - hintBounds.width - 5}px`;
                    } else if (this.position === "right") {
                        hintElement.style.top = `${anchorBounds.y - hintBounds.height / 2 + anchorBounds.height / 2}px`;
                        hintElement.style.left = `${anchorBounds.x + anchorBounds.width + 5}px`;
                    }
                } catch (_ignoredMissingElement) {
                    // The hint may disappear between the component update and nextTick.
                }
            });
        }
    };

    return defineComponent(options, function renderHint() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", viewModel._g({
            ref: "hint",
            staticClass: "main-hint-view flex flex-col justify-center items-center w-[18px] h-[18px]",
            on: {
                mouseenter: viewModel.startCounting,
                mouseleave: viewModel.stopCounting
            }
        }, viewModel.$listeners), [
            viewModel.isShowHint
                ? createElement("span", { ref: "hint-text", staticClass: "hint" }, [viewModel._v(viewModel._s(viewModel.hint))])
                : viewModel._e(),
            viewModel._v(" "),
            viewModel._t("default")
        ], 2);
    }, "6e240a95");
}

module.exports = { createHint };
