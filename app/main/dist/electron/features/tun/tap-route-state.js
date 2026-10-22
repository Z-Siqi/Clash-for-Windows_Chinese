"use strict";

const { isIPv4 } = require("../../core/network/browser-ip");

function networkAddress(ip, mask) {
    return ip.split(".").map((part, index) => Number(part) & Number(mask.split(".")[index])).join(".");
}

// Parse only active IPv4 rows. Persistent routes have four columns and must
// not count as an operational TAP link. The on-link gateway word is localized.
function tapRouteState(output, { ip, subnet, gateway }) {
    const routes = String(output).split(/\r?\n/).map(line => line.trim().split(/\s+/))
        .filter(fields => fields.length === 5 && isIPv4(fields[0]) && isIPv4(fields[1])
            && isIPv4(fields[3]) && /^\d+$/.test(fields[4]));
    return {
        connected: routes.some(fields => fields[0] === networkAddress(ip, subnet) && fields[1] === subnet && fields[3] === ip),
        defaultRoute: routes.some(fields => fields[0] === "0.0.0.0" && fields[1] === "0.0.0.0" && fields[2] === gateway && fields[3] === ip)
    };
}

module.exports = { tapRouteState };
