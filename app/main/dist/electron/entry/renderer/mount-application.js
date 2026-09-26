"use strict";

const { createGlobalMixin } = require("./global-mixin");
const { createApplicationComponent, createDialogPlugin } = require("../../features/renderer-ui/application");

function mountRendererApplication(deps) {
    const { Vue, store, router, document, dialogs, plugins, electronPlugin } = deps;
    if (electronPlugin) Vue.use(electronPlugin);
    for (const plugin of plugins) Vue.use(plugin, { store });
    Vue.config.productionTip = false;
    // Vue merges mixins when constructing an instance, not when a later plugin is installed.
    Vue.mixin(createGlobalMixin(deps));
    Vue.use(createDialogPlugin({ components: dialogs, document }), { store });
    const App = createApplicationComponent({ document });
    return new Vue({ router, store, render: createElement => createElement(App) }).$mount("#app");
}

module.exports = { mountRendererApplication };
