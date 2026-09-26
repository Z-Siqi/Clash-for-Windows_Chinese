"use strict";

const proxyStatus = Object.freeze({
    INIT: Symbol("INIT"),
    DEFAULT: Symbol("DEFAULT"),
    SYSTEM_PROXY: Symbol("SYSTEM_PROXY")
});

const connectionStatus = Object.freeze({
    CONNECTED: Symbol("CONNECTED"),
    DISCONNECTED: Symbol("DISCONNECTED")
});

module.exports = { connectionStatus, proxyStatus };
