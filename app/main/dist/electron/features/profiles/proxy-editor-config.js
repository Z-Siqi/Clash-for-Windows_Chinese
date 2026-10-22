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
    const unchanged = field => sameType && state.initialValues && Object.hasOwn(state.initialValues, field)
        && state.initialValues[field] === state[field];
    delete proxy._index;
    Object.assign(proxy, {
        name: state.proxyName,
        type: state.proxyType,
        server: state.proxyServer,
        port: optionalNumber(state.proxyPort)
    });

    if (state.proxyType === "anytls") {
        proxy.password = state.proxyPassword;
        // Saved omission can select a core default; a rename must not replace it
        // with the form's defaults for newly created AnyTLS nodes.
        if (!unchanged("proxyUdp")) proxy.udp = state.proxyUdp === true;
        for (const [key, field, value] of [
            ["client-fingerprint", "proxyClientFingerprint", compact(state.proxyClientFingerprint)],
            ["sni", "proxySni", compact(state.proxySni)],
            ["alpn", "proxyAlpn", parseAlpn(state.proxyAlpn)],
            ["idle-session-check-interval", "proxyIdleSessionCheckInterval", optionalNumber(state.proxyIdleSessionCheckInterval)],
            ["idle-session-timeout", "proxyIdleSessionTimeout", optionalNumber(state.proxyIdleSessionTimeout)],
            ["min-idle-session", "proxyMinIdleSession", optionalNumber(state.proxyMinIdleSession)]
        ]) {
            if (!unchanged(field)) assignOptional(proxy, key, value);
        }
        if (!unchanged("proxySkipCertVerify")) {
            if (state.proxySkipCertVerify) proxy["skip-cert-verify"] = true;
            else delete proxy["skip-cert-verify"];
        }
        return proxy;
    }

    if (state.proxyType === "ss") {
        proxy.cipher = state.proxyChipher;
        proxy.password = state.proxyPassword;
        if (sameType && proxy.plugin && proxy.plugin !== "obfs") {
            // This form only edits obfs fields; preserve other plugin protocols.
        } else if (state.proxyObfs) {
            proxy.plugin = "obfs";
            proxy["plugin-opts"] = { ...proxy["plugin-opts"], mode: state.proxyObfs, host: state.proxyObfshost || "bing.com" };
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
            const options = { ...proxy["ws-opts"], path: state.proxyWsPath };
            if (state.proxyWsHeaders?.trim()) options.headers = JSON.parse(state.proxyWsHeaders);
            else delete options.headers;
            proxy["ws-opts"] = options;
        } else {
            if (state.proxyNetwork && state.proxyNetwork !== "tcp") proxy.network = state.proxyNetwork;
            else delete proxy.network;
            delete proxy["ws-opts"];
        }
    } else if (state.proxyType === "socks5" || state.proxyType === "http") {
        assignOptional(proxy, "username", compact(state.proxyUsername));
        assignOptional(proxy, "password", compact(state.proxyPassword));
        if (state.proxyTls) proxy.tls = true;
        else delete proxy.tls;
        if (state.proxySkipCertVerify) proxy["skip-cert-verify"] = true;
        else delete proxy["skip-cert-verify"];
    }
    return proxy;
}

module.exports = { buildProxyConfig, parseAlpn };
