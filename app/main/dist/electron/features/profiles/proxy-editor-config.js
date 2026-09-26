"use strict";

function compact(value) {
    return value === "" || value === undefined || value === null ? undefined : value;
}

function optionalNumber(value) {
    const normalized = compact(value);
    if (normalized === undefined) return undefined;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : normalized;
}

function parseAlpn(value) {
    if (Array.isArray(value)) return value;
    const normalized = compact(value);
    if (normalized === undefined) return undefined;
    return String(normalized).split(/[\n,]/).map(item => item.trim()).filter(Boolean);
}

function assignOptional(target, key, value) {
    if (value === undefined) delete target[key];
    else target[key] = value;
}

function buildProxyConfig(state) {
    const sameType = state.original && state.original.type === state.proxyType;
    const proxy = sameType ? { ...state.original } : {};
    delete proxy._index;
    Object.assign(proxy, {
        name: state.proxyName,
        type: state.proxyType,
        server: state.proxyServer,
        port: optionalNumber(state.proxyPort)
    });

    if (state.proxyType === "anytls") {
        proxy.password = state.proxyPassword;
        proxy.udp = state.proxyUdp === true;
        assignOptional(proxy, "client-fingerprint", compact(state.proxyClientFingerprint));
        assignOptional(proxy, "sni", compact(state.proxySni));
        assignOptional(proxy, "alpn", parseAlpn(state.proxyAlpn));
        assignOptional(proxy, "idle-session-check-interval", optionalNumber(state.proxyIdleSessionCheckInterval));
        assignOptional(proxy, "idle-session-timeout", optionalNumber(state.proxyIdleSessionTimeout));
        assignOptional(proxy, "min-idle-session", optionalNumber(state.proxyMinIdleSession));
        if (state.proxySkipCertVerify) proxy["skip-cert-verify"] = true;
        else delete proxy["skip-cert-verify"];
        return proxy;
    }

    if (state.proxyType === "ss") {
        proxy.cipher = state.proxyChipher;
        proxy.password = state.proxyPassword;
        if (state.proxyObfs) {
            proxy.plugin = "obfs";
            proxy["plugin-opts"] = { mode: state.proxyObfs, host: state.proxyObfshost || "bing.com" };
        } else {
            delete proxy.plugin;
            delete proxy["plugin-opts"];
        }
    } else if (state.proxyType === "vmess") {
        proxy.uuid = state.proxyUuid;
        proxy.alterId = optionalNumber(state.proxyAlterid);
        proxy.cipher = state.proxyChipher;
        if (state.proxyTls) proxy.tls = true;
        else delete proxy.tls;
        if (state.proxySkipCertVerify) proxy["skip-cert-verify"] = true;
        else delete proxy["skip-cert-verify"];
        if (state.proxyNetwork === "ws") {
            proxy.network = "ws";
            const options = { path: state.proxyWsPath };
            try { options.headers = JSON.parse(state.proxyWsHeaders); } catch (_error) {}
            proxy["ws-opts"] = options;
        } else {
            delete proxy.network;
            delete proxy["ws-opts"];
        }
    } else if (state.proxyType === "socks5" || state.proxyType === "http") {
        if (state.proxyUsername && state.proxyPassword) {
            proxy.username = state.proxyUsername;
            proxy.password = state.proxyPassword;
        }
        if (state.proxyTls) proxy.tls = true;
        else delete proxy.tls;
        if (state.proxySkipCertVerify) proxy["skip-cert-verify"] = true;
        else delete proxy["skip-cert-verify"];
    }
    return proxy;
}

module.exports = { buildProxyConfig, parseAlpn };
