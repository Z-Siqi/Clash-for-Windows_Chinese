"use strict";

const { randomUUID } = require("crypto");

function v4() {
    return randomUUID();
}

module.exports = { v4 };
