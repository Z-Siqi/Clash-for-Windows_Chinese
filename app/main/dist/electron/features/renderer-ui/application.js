"use strict";

function createApplicationComponent({ document }) {
    return {
        name: "Clash",
        watch: {
            theme: { immediate: true, handler(theme) { document.body.className = `theme-${theme}`; } }
        },
        render(h) { return h("div", { attrs: { id: "app" } }, [h("router-view")]); }
    };
}

// These are application-wide singleton dialogs, shared by every routed page.
function createDialogPlugin({ components, document }) {
    return {
        install(Vue, { store }) {
            for (const [name, component] of Object.entries(components)) {
                const instance = new (Vue.extend({ ...component, store }))();
                document.body.appendChild(instance.$mount().$el);
                Vue.prototype[`$${name}`] = instance.show;
            }
        }
    };
}

module.exports = { createApplicationComponent, createDialogPlugin };
