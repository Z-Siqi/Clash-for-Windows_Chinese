"use strict";

function createSettingsPageComponents({ defineComponent, Vuex, draggable, getLanguage }) {
    const Section = defineComponent({
        name: "setting-section",
        props: { title: String }
    }, function renderSettingSection() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return viewModel.$slots.default?.length ? createElement("div", {
            staticClass: "main-setting-section"
        }, [
            createElement("div", { staticClass: "title" }, [viewModel._v(viewModel._s(viewModel.title))]),
            viewModel._v(" "),
            createElement("div", { staticClass: "content" }, [viewModel._t("default")], 2)
        ]) : viewModel._e();
    }, "18adce47");

    const KeyCapture = defineComponent({
        name: "key-capture",
        props: {
            value: { type: String, default: "" },
            placeholder: String
        },
        model: { prop: "value", event: "change" },
        data() {
            return { isRecording: false, keyChain: [] };
        },
        watch: {
            isRecording(value) {
                if (!value) this.$emit("change", this.shortcut);
            }
        },
        computed: {
            ...Vuex.mapState({}),
            shortcut() { return this.keyChain.join("+"); },
            hint() { return this.isRecording ? getLanguage().recording() : this.placeholder; }
        },
        methods: {
            handleKeyDown(event) {
                if (!this.isRecording) return;
                if (event.keyCode === 13) this.isRecording = false;
                else if (event.key) this.keyChain.push(event.key);
            },
            handleClick() {
                this.keyChain = [];
                this.isRecording = true;
                this.$emit("change", "");
            },
            handleBlur() { this.isRecording = false; }
        },
        mounted() { this.keyChain = this.value.split("+"); }
    }, function renderKeyCapture() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", { staticClass: "main-key-capture" }, [
            createElement("input", {
                class: [viewModel.isRecording ? "recording" : ""],
                style: { padding: "10px" },
                attrs: { placeholder: viewModel.hint, readonly: "" },
                domProps: { value: viewModel.shortcut },
                on: { click: viewModel.handleClick, keydown: viewModel.handleKeyDown, blur: viewModel.handleBlur }
            }),
            viewModel._v(" "),
            createElement("div", {
                staticClass: "hint",
                class: [viewModel.isRecording ? "" : "hint-hide"]
            }, [viewModel._v(`\n    ${getLanguage().pressEnterStop()}\n  `)])
        ]);
    }, "2ddf36e7");

    const MoreHint = defineComponent({
        name: "more-hint",
        props: {
            text: String,
            clickable: { type: Boolean, default: true }
        }
    }, function renderMoreHint() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        return createElement("div", {
            class: ["main-more-hint", viewModel.clickable ? "clickable" : ""],
            on: { click() { return viewModel.$emit("click"); } }
        }, [
            createElement("div", { staticClass: "text" }, [viewModel._v(viewModel._s(viewModel.text))]),
            viewModel._v(" "),
            viewModel.clickable ? createElement("div", { staticClass: "tirangle" }) : viewModel._e()
        ]);
    }, "6a8f4af4");

    const Separator = defineComponent({ name: "separator" }, function renderSeparator() {
        return this._self._c("div", { staticClass: "main-settings-separator" });
    }, "26bdfd95");

    const TrayOrder = defineComponent({
        name: "TrayOrder",
        components: { draggable },
        props: {
            arr: { type: Array, default: () => [[], []] }
        },
        model: { prop: "arr", event: "drag" },
        watch: {
            arr: {
                deep: true,
                handler(value) { this.array = value; }
            }
        },
        data() { return { array: this.arr }; },
        methods: {
            handleDrag() { this.$emit("drag", this.array); }
        }
    }, function renderTrayOrder() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = getLanguage();
        const renderTrayIcon = name => createElement("img", {
            key: name,
            staticClass: "cursor-move",
            attrs: { src: `static/imgs/tray-${name}.png`, alt: "" }
        });
        return createElement("div", { staticClass: "tray-order-main" }, [
            createElement("div", { staticClass: "title" }, [viewModel._v(`${labels.show()}:`)]),
            viewModel._v(" "),
            createElement("draggable", {
                staticClass: "list left-list",
                attrs: { group: "tray", list: viewModel.array[0] },
                on: { change: viewModel.handleDrag }
            }, viewModel._l(viewModel.array[0], renderTrayIcon), 0),
            viewModel._v(" "),
            createElement("div", { staticClass: "title" }, [viewModel._v(`${labels.hide()}:`)]),
            viewModel._v(" "),
            createElement("draggable", {
                staticClass: "list",
                attrs: { group: "tray", list: viewModel.array[1] },
                on: { change: viewModel.handleDrag }
            }, viewModel._l(viewModel.array[1], renderTrayIcon), 0)
        ], 1);
    }, "40749f51");

    return { Section, KeyCapture, MoreHint, Separator, TrayOrder };
}

module.exports = { createSettingsPageComponents };
