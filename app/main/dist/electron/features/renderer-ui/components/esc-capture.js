"use strict";

const { defineComponent } = require("../component");

function createEscCapture() {
    const options = {
        name: "EscCapture",
        methods: {
            handleKeyDown(event) {
                const key = String(event.key || "").toLowerCase();
                const isCloseShortcut = (event.metaKey || event.ctrlKey)
                    && (event.keyCode === 87 || key === "w");
                const isEscape = event.keyCode === 27 || key === "escape";
                if (!isCloseShortcut && !isEscape) return;

                // Keep the dashboard-level Escape/Ctrl-W handler from closing the
                // BrowserWindow after the active overlay handles the same event.
                if (event.preventDefault) event.preventDefault();
                if (event.stopPropagation) event.stopPropagation();
                this.$emit("esc");
            }
        },
        mounted() {
            if (this.$el.focus) this.$el.focus();
        }
    };

    return defineComponent(options, function renderEscCapture() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", viewModel._g({
            staticClass: "no-esc",
            attrs: { tabindex: "0" },
            on: { keydown: viewModel.handleKeyDown }
        }, viewModel.$listeners), [viewModel._t("default")], 2);
    }, "3ccabdf6");
}

module.exports = { createEscCapture };
