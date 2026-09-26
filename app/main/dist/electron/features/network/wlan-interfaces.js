"use strict";

function listWlanInterfaces({ platform, execSync }) {
    let command;
    if (platform === "win32") command = "chcp 65001 && netsh wlan show interfaces";
    else if (platform === "darwin") {
        command = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport --getinfo";
    } else return [];

    const lines = execSync(command).toString().split("\n");
    const interfaces = [];
    let current = {};
    for (const [index, line] of lines.entries()) {
        const separator = line.indexOf(": ");
        if (separator >= 0) {
            const key = line.slice(0, separator).trim();
            const value = line.slice(separator + 2).trim();
            if (key && value) {
                if (Object.hasOwn(current, key)) {
                    interfaces.push(current);
                    current = {};
                }
                current[key] = value;
            }
        }
        if (index === lines.length - 1) interfaces.push(current);
    }
    return interfaces;
}

module.exports = { listWlanInterfaces };
