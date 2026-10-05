"use strict";

const config = Object.freeze(require("./release-config.json"));
const releasesUrl = `https://github.com/${config.repository}/releases`;
const updateUrl = `https://raw.githubusercontent.com/${config.repository}/${config.updateBranch}/update`;

function versionParts(value) {
    const text = String(value).replace(/^v/, "").replace(/-Opt[.-](\d+)$/, ".$1");
    if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(text)) throw new Error("Invalid release version");
    const parts = text.split(".").map(Number);
    if (parts.some(part => !Number.isSafeInteger(part))) throw new Error("Invalid release version");
    return parts;
}

function compareVersions(left, right) {
    const leftParts = versionParts(left), rightParts = versionParts(right);
    for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index++) {
        const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
        if (difference) return Math.sign(difference);
    }
    return 0;
}

function displayVersion(value = config.displayVersion) {
    // The label also appears in installer filenames; keep it path-safe.
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)) throw new Error("Invalid display version");
    return value;
}

function releasePage(version = config.version) {
    versionParts(version);
    return `${releasesUrl}/tag/${encodeURIComponent(version)}`;
}

function assetName(target, version = config.version, portable = false, label = config.displayVersion) {
    versionParts(version);
    const suffixes = {
        "win-x64": portable ? "-win.7z" : ".exe",
        "win-arm64": portable ? "-arm64-win.7z" : ".arm64.exe",
        "mac-x64": portable ? "-mac.7z" : ".dmg",
        "mac-arm64": portable ? "-arm64-mac.7z" : "-arm64.dmg",
        "linux-x64": "-x64-linux.tar.gz",
        "linux-arm64": "-arm64-linux.tar.gz"
    };
    if (!suffixes[target]) throw new Error("Unsupported release target");
    // Keep the published Windows installer name compatible with older releases.
    if (!portable && target.startsWith("win-")) {
        return `Clash.for.Windows.Setup_${displayVersion(label)}${target === "win-arm64" ? ".arm64" : ""}.exe`;
    }
    return `Clash.for.Windows-${version}${suffixes[target]}`;
}

function assetUrl(name, version = config.version) {
    return `${releasesUrl}/download/${encodeURIComponent(version)}/${encodeURIComponent(name)}`;
}

function createUpdateFeed({ version = config.version, displayVersion: label = config.displayVersion, targets = config.publishedTargets, body = "- **新版本已发布!**" } = {}) {
    return {
        html_url: releasePage(version), tag_name: version, display_version: displayVersion(label),
        assets: targets.map(target => {
            const name = assetName(target, version, false, label);
            return { name, browser_download_url: assetUrl(name, version) };
        }), body, reactions: {}
    };
}

module.exports = { config, releasesUrl, updateUrl, versionParts, compareVersions, displayVersion, releasePage, assetName, assetUrl, createUpdateFeed };
