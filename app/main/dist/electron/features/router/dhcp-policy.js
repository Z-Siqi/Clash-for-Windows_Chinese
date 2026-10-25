"use strict";

const { isIPv4 } = require("../../core/network/browser-ip");

// Match the server's existing identity order, including clients without option 61.
function clientIdentity(client) {
    return client.options?.[61] || client.clientId || client.chaddr;
}

function clientPolicyIdentity(client) {
    const identity = client.policyIdentity;
    if (identity?.kind === "sha256" && typeof identity.value === "string" && /^[a-f0-9]{64}$/.test(identity.value)) return identity;
    if (identity?.kind === "raw" && typeof identity.value === "string" && identity.value.length > 0 && identity.value.length <= 128) return identity;
    const value = clientIdentity(client);
    return typeof value === "string" && value.length > 0 && value.length <= 128 ? { kind: "raw", value } : null;
}

function savedIdentityTokens(value) {
    return Array.isArray(value) ? value.filter(item => typeof item === "string" && /^[a-f0-9]{64}$/.test(item)) : [];
}

function savedIdentities(value) {
    // Older UI selections without option 61 were persisted as null.
    return Array.isArray(value) ? value.filter(item => typeof item === "string" && item.length > 0) : [];
}

function broadcastAddress(address, netmask) {
    if (!isIPv4(address) || !isIPv4(netmask)) return "";
    const number = value => value.split(".").reduce((result, part) => (result * 256 + Number(part)) >>> 0, 0);
    const mask = number(netmask);
    const inverse = (~mask) >>> 0;
    if (inverse < 3 || inverse > 0x7fffffff || (inverse & (inverse + 1)) !== 0) return "";
    const broadcast = ((number(address) & mask) | inverse) >>> 0;
    return [24, 16, 8, 0].map(shift => (broadcast >>> shift) & 255).join(".");
}

module.exports = { clientIdentity, clientPolicyIdentity, savedIdentities, savedIdentityTokens, broadcastAddress };
