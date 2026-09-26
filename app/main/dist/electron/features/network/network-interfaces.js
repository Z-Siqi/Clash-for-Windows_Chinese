"use strict";

function listNetworkInterfaces({ networkInterfaces }) {
    const result = [];
    for (const [name, addresses] of Object.entries(networkInterfaces())) {
        for (const address of addresses || []) {
            if (!address.internal && address.family !== "IPv6") {
                result.push({ name, address: address.address });
            }
        }
    }
    return result;
}

function detectDefaultInterface({
    platform,
    execSync,
    networkInterfaces,
    isIP,
    isIPv4
}) {
    if (platform === "darwin") {
        const routes = execSync("netstat -nr | grep default ")
            .toString()
            .split("\n")
            .map(line => line.trim().split(/\s+/))
            .filter(columns => columns.length === 4 && isIPv4(columns[1]));
        const interfaces = networkInterfaces();
        for (const route of routes) {
            if (Object.hasOwn(interfaces, route[3])) return route[3];
        }
        return Object.hasOwn(interfaces, "en0") ? "en0" : null;
    }

    if (platform === "win32") {
        const routes = execSync("route print 0.0.0.0 mask 0.0.0.0", { windowsHide: true })
            .toString()
            .split("\n")
            .map(line => line.trim().split(/\s+/))
            .filter(columns => columns.length === 5
                && columns.slice(0, 4).every(isIP)
                && Number.isFinite(Number.parseInt(columns[4], 10)))
            .sort((left, right) => Number.parseInt(left[4], 10) - Number.parseInt(right[4], 10));
        const interfaces = { ...networkInterfaces() };
        delete interfaces["cfw-tap"];
        for (const route of routes) {
            const localAddress = route[3];
            for (const [name, addresses] of Object.entries(interfaces)) {
                if ((addresses || []).some(address => address.address === localAddress)) return name;
            }
        }
        if (Object.hasOwn(interfaces, "以太网")) return "以太网";
        if (Object.hasOwn(interfaces, "WLAN")) return "WLAN";
    }

    return null;
}

module.exports = { detectDefaultInterface, listNetworkInterfaces };
