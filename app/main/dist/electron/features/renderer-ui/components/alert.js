"use strict";

const { defineComponent } = require("../component");

function createAlert({ Vuex, escCaptureComponent, Language, modifyState } = {}) {
    const options = {
        components: { EscCapture: escCaptureComponent },
        name: "AlertView",
        props: [],
        data() {
            return {
                isShow: false,
                content: "",
                title: "错误",
                isShowErrorBtn: false,
                resolve: null,
                reject: null
            };
        },
        computed: {
            ...Vuex.mapState({}),
            ...Vuex.mapGetters(["theme"])
        },
        methods: {
            show({ title = "错误", content = "", isShowErrorBtn = false }) {
                this.isShow = true;
                this.title = title;
                this.content = content;
                this.isShowErrorBtn = isShowErrorBtn;
                return new Promise((resolve, reject) => {
                    this.resolve = resolve;
                    this.reject = reject;
                });
            },
            handleKeyDown(event) {
                if (event.keyCode === 13) this.handleDone();
            },
            handleCancel() {
                this.isShow = false;
                this.reject();
            },
            handleDone() {
                this.isShow = false;
                this.resolve({});
            }
        }
    };

    return defineComponent(options, function renderAlert() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        const labels = new Language(modifyState.language);
        if (!viewModel.isShow) return viewModel._e();

        return createElement("EscCapture", {
            staticClass: "main-alert-view-plugin bg-[color:var(--mask-c)]",
            class: [`theme-${viewModel.theme}`],
            on: { esc: viewModel.handleCancel, mousedown: viewModel.handleCancel }
        }, [createElement("div", {
            staticClass: "card-main bg-[color:var(--bgc)] text-[color:var(--fgc)]",
            on: { mousedown: event => event.stopPropagation() }
        }, [createElement("div", { staticClass: "card-content" }, [
            createElement("div", { staticClass: "content-title" }, [viewModel._v(viewModel._s(viewModel.title))]),
            viewModel._v(" "),
            createElement("div", { staticClass: "content-content" }, [viewModel._v(viewModel._s(viewModel.content))]),
            viewModel._v(" "),
            createElement("div", { staticClass: "card-btns" }, [
                viewModel.isShowErrorBtn
                    ? createElement("div", { staticClass: "btn btn-cancel", on: { click: viewModel.handleCancel } }, [viewModel._v(`\n          ${labels.cancel()}\n        `)])
                    : viewModel._e(),
                viewModel._v(" "),
                createElement("div", { staticClass: "btn btn-ok", on: { click: viewModel.handleDone } }, [viewModel._v(labels.ok())])
            ])
        ])])]);
    }, "12619986");
}

module.exports = { createAlert };
