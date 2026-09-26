"use strict";

function createValueTools({ crypto, BigNumber, schedule = setTimeout }) {
    const flattenValues = value => Object.values(value).map(item => typeof item === "object" ? flattenValues(item) : item).join("\n");
    return {
        delay: milliseconds => new Promise(resolve => schedule(resolve, milliseconds)),
        hashText: value => crypto.createHash("md5").update(value).digest("hex"),
        cloneJson: value => JSON.parse(JSON.stringify(value)),
        formatBytes(value, precision = 2, space = true) {
            const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
            let index = 0;
            while (BigNumber(value).dividedBy(1024).isGreaterThan(1) && index < units.length) {
                value = BigNumber(value).dividedBy(1024);
                index++;
            }
            return `${value.toFixed(precision)}${space ? " " : ""}${units[index]}`;
        },
        shortenText(value, length) {
            if (value.length <= length) return value;
            const first = parseInt(length / 2);
            return `${value.slice(0, first)}...${value.slice(-(length - first))}`;
        },
        flattenValues,
        isPortInRange: value => (typeof value === "number" || typeof value === "string")
            && Number.isInteger(Number(value)) && value > 0 && value < 65536
    };
}

module.exports = { createValueTools };
