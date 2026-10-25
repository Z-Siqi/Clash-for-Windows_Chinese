"use strict";

function isIPv4(value) {
    if (typeof value !== "string") return false;
    const parts = value.split(".");
    return parts.length === 4 && parts.every(part => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
}
function isIP(value) {
    if (isIPv4(value)) return 4;
    if (typeof value !== "string" || !value.includes(":")) return 0;
    try { return new URL(`http://[${value.split("%")[0]}]/`).hostname ? 6 : 0; } catch { return 0; }
}

module.exports = { isIP, isIPv4 };
