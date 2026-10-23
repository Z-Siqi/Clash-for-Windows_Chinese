"use strict";

const { normalizeCoreType, CORE_TYPES } = require("../../core/clash-core/core-selection");

const BASE_FAKE_IP_FILTERS = [
    "+.stun.*.*",
    "+.stun.*.*.*",
    "+.stun.*.*.*.*",
    "+.stun.*.*.*.*.*",
    "*.n.n.srv.nintendo.net",
    "+.stun.playstation.net",
    "xbox.*.*.microsoft.com",
    "*.*.xboxlive.com"
];

function buildTunConfig(settings = {}, platform = process.platform, coreType) {
    settings = settings || {};
    const {
        ipv6 = false,
        nameServers = ["8.8.8.8", "1.1.1.1", "94.140.14.14"],
        fallbackServers = [],
        defaultNameservers = [],
        fakeIPFilters,
        nameserverPolicy = {},
        stackType = 0,
        interfaceName = "",
        isAutoDetectInterface = true,
        dnsHijacks = [],
        isAutoRedir,
        isAutoRedirAutoRoute
    } = settings;

    const platformFilters = platform === "win32"
        ? ["*.msftncsi.com", "*.msftconnecttest.com", "WORKGROUP"]
        : platform === "darwin" ? ["apps.apple.com"] : [];
    const config = {
        dns: {
            enable: true,
            ipv6,
            "enhanced-mode": "fake-ip",
            "default-nameserver": defaultNameservers,
            nameserver: nameServers,
            fallback: fallbackServers,
            "nameserver-policy": nameserverPolicy,
            "fake-ip-filter": fakeIPFilters === undefined
                ? [...BASE_FAKE_IP_FILTERS, ...platformFilters]
                : fakeIPFilters
        },
        tun: {
            enable: true,
            stack: ["gvisor", "system"][stackType],
            "auto-route": true,
            "dns-hijack": dnsHijacks
        }
    };

    if (isAutoDetectInterface) config.tun["auto-detect-interface"] = true;
    else config["interface-name"] = interfaceName;

    if (platform === "linux" && normalizeCoreType(coreType) === CORE_TYPES.CLASH) {
        config["auto-redir"] = {
            enable: isAutoRedir,
            "auto-route": isAutoRedirAutoRoute
        };
    } else if (platform === "linux" && typeof settings.mihomoAutoRedirect === "boolean") {
        // A separate, explicitly confirmed choice prevents old ignored UI values
        // from starting Linux redirection rules during an upgrade or core switch.
        config.tun["auto-redirect"] = settings.mihomoAutoRedirect;
    }
    if (defaultNameservers.length === 0) delete config.dns["default-nameserver"];
    return config;
}

module.exports = { BASE_FAKE_IP_FILTERS, buildTunConfig };
