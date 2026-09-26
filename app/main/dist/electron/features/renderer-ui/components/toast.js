"use strict";

const { defineComponent } = require("../component");

function createToast({ Vuex, schedule = setTimeout, cancel = clearTimeout } = {}) {
    const options = {
        components: {},
        name: "ToastView",
        props: [],
        data() {
            return { isShow: false, content: "", hint: "", timeoutID: null };
        },
        computed: {
            ...Vuex.mapState({}),
            ...Vuex.mapGetters(["theme"])
        },
        methods: {
            show({ content, hint, timeout = 3000 }) {
                if (!content) return;
                this.isShow = true;
                this.content = content;
                this.hint = hint;
                if (this.timeoutID) cancel(this.timeoutID);
                this.timeoutID = schedule(() => {
                    this.isShow = false;
                }, timeout);
            }
        }
    };

    return defineComponent(options, function renderToast() {
        const viewModel = this;
        const createElement = viewModel._self._c;
        if (!viewModel.isShow) return viewModel._e();
        return createElement("div", {
            staticClass: "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[350px] bg-black text-white rounded-2xl font-normal px-4 py-2 shadow-xl fade"
        }, [
            createElement("div", { staticClass: "text-base" }, [viewModel._v(viewModel._s(viewModel.content))]),
            viewModel._v(" "),
            viewModel.hint
                ? createElement("div", { staticClass: "text-xs" }, [viewModel._v(viewModel._s(viewModel.hint))])
                : viewModel._e()
        ]);
    }, null);
}

module.exports = { createToast };
