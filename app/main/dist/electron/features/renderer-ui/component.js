"use strict";

// Retain the original scope IDs so existing packaged CSS also styles migrated components.
function defineComponent(options, render, scopeId = null, staticRenderFns = []) {
    return {
        ...options, render, staticRenderFns, _compiled: true,
        ...(scopeId ? { _scopeId: `data-v-${scopeId}` } : {})
    };
}

module.exports = { defineComponent };
