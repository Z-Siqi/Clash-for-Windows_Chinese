"use strict";

const { MIN_PORT, MAX_PORT, parsePort } = require("../../core/network/tcp-port");
const DASHBOARD_ORIGIN = "http://yacd.haishan.me/";

function buildDashboardUrl({ controllerPort, secret = "" }) {
    const port = parsePort(controllerPort);
    if (port === null) throw new RangeError("Controller port must be between 1 and 65535");
    const params = new URLSearchParams({
        hostname: "127.0.0.1",
        port: String(port),
        secret: String(secret)
    });
    return `${DASHBOARD_ORIGIN}?${params.toString()}`;
}

module.exports = { MIN_PORT, MAX_PORT, parsePort, buildDashboardUrl };
