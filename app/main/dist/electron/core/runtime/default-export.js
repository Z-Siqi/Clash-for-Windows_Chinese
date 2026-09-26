"use strict";

// Match the legacy CommonJS/ES-module interop used by injected bundled dependencies.
function defaultExport(value) { return () => value && value.__esModule ? value.default : value; }
module.exports = { defaultExport };
