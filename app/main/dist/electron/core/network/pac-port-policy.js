"use strict";

const { parsePort } = require("./tcp-port");

function pacPortPolicy(value) {
    const automatic = value == null || String(value).trim() === "";
    const port = parsePort(value);
    return { port, invalid: !automatic && port === null };
}

module.exports = { pacPortPolicy };
