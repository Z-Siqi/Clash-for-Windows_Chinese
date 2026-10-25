"use strict";

function normalizeCertificateExceptions(values, originsOnly = false) {
    if (!Array.isArray(values) || values.length > 128) return [];
    const urls = [];
    for (const value of values) {
        try {
            if (typeof value !== "string" || value.length > 4096) return [];
            const url = new URL(value);
            if (url.protocol !== "https:" || url.username || url.password) return [];
            if (originsOnly && (url.pathname !== "/" || url.search || url.hash || url.hostname.includes("*"))) return [];
            urls.push(originsOnly ? url.origin : url.href);
        } catch { return []; }
    }
    return urls;
}

function matchesCertificateException(value, urls, origins) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password
            && (urls.has(url.href) || origins.has(url.origin));
    } catch { return false; }
}

function createCertificateExceptionMatcher({ yaml, text, originsText }) {
    let values, originValues;
    try { values = yaml.parse(text)?.urls; } catch { /* Invalid settings grant no exceptions. */ }
    try { originValues = yaml.parse(originsText)?.origins; } catch { /* Origins require a separate explicit grant. */ }
    const urls = new Set(normalizeCertificateExceptions(values));
    const origins = new Set(normalizeCertificateExceptions(originValues, true));
    return value => matchesCertificateException(value, urls, origins);
}

module.exports = { normalizeCertificateExceptions, matchesCertificateException, createCertificateExceptionMatcher };
