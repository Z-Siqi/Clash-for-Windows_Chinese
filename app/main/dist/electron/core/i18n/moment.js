"use strict";

const moment = require("moment");

// Sandboxed browser bundles cannot load Moment's locales through dynamic
// require. Register supported locales without changing the shared default.
const defaultLocale = moment.locale();
require("moment/locale/zh-cn");
moment.locale(defaultLocale);

module.exports = moment;
