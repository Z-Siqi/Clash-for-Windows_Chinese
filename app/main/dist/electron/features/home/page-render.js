"use strict";

function renderHomePage() {
    const viewModel = this;
    const createElement = viewModel._self._c;
    return createElement("div", {
        staticClass: "wrapper bg-[color:var(--bgc)] text-[color:var(--fgc)]"
    }, [
        viewModel.theme === "2077" ? createElement("img", {
            staticClass: "cloud opacicy",
            attrs: { src: "static/imgs/2077.png" }
        }) : viewModel._e(),
        viewModel._v(" "),
        viewModel.theme === "mc" ? createElement("img", {
            staticClass: "cloud opacicy",
            attrs: { src: "static/imgs/minecraft.png" }
        }) : viewModel._e(),
        viewModel._v(" "),
        createElement("StatusBar"),
        viewModel._v(" "),
        createElement("main", [
            createElement("div", { staticClass: "left-side" }, [createElement("main-menu", {
                attrs: {
                    "download-progress": viewModel.pkgDownloadProgress,
                    "start-time": viewModel.startTime,
                    profileUpdateFailedURLs: viewModel.profileUpdateFailedURLs,
                    "keyboard-click-times": viewModel.menuKeyboardClickTimes
                }
            })], 1),
            viewModel._v(" "),
            createElement("div", { staticClass: "right-side" }, [
                createElement("keep-alive", [viewModel.$route.meta.keepAlive ? createElement("router-view", {
                    on: { refreshProfile: viewModel.refreshProfile }
                }) : viewModel._e()], 1),
                viewModel._v(" "),
                viewModel.$route.meta.keepAlive ? viewModel._e() : createElement("router-view", {
                    on: { refreshProfile: viewModel.refreshProfile }
                })
            ], 1),
            viewModel._v(" "),
            createElement("div", { staticClass: "clash-status-main" }, [
                createElement("div", { class: viewModel.statusIcon }),
                viewModel._v(" "),
                createElement("div", {
                    staticClass: "clash-status-hint",
                    on: { click() { return viewModel.showLogsFolder(); } }
                }, [viewModel._v(`\n        ${viewModel._s(viewModel.statusHint)}\n      `)])
            ])
        ])
    ], 1);
}

module.exports = { renderHomePage };
