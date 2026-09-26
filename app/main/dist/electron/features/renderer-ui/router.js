"use strict";

function createRendererRouter({ Vue, Router, pages }) {
    Vue.use(Router);
    const children = ["general", "proxy", "provider", "log", "server", "connection", "router", "setting", "about"]
        .map(path => ({ path, component: pages[path], ...(path === "log" ? {} : { meta: { keepAlive: true } }) }));
    return new Router({
        routes: [
            { path: "/home", name: "landing-page", component: pages.home, children },
            { path: "*", redirect: "/home/general" }
        ],
        saveScrollPosition: true
    });
}

module.exports = { createRendererRouter };
