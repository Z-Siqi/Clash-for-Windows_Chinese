"use strict";

const { assetName, assetUrl, versionParts } = require("./release-info");

const legacyInstallers = {
    "win-x64": /\d+\.\d+\.\d+(?:\.\d+)?(?:-Opt\.\d+)?\.exe$/,
    "win-arm64": /[.-]arm64\.exe$/,
    "mac-x64": /(?<!-arm64)\.dmg$/,
    "mac-arm64": /-arm64\.dmg$/,
    "linux-x64": /-x64-linux\.tar\.gz$/,
    "linux-arm64": /-arm64-linux\.tar\.gz$/
};
const legacyPortable = {
    "win-x64": /(?<!-arm64)(?<!-ia32)-win\.7z$/,
    "win-arm64": /-arm64-win\.7z$/,
    "mac-x64": /(?<!-arm64)-mac\.7z$/,
    "mac-arm64": /-arm64-mac\.7z$/,
    "linux-x64": legacyInstallers["linux-x64"],
    "linux-arm64": legacyInstallers["linux-arm64"]
};

function selectReleaseAsset(release, { platform, arch, portable = false }) {
    const prefix = { win32: "win", darwin: "mac", linux: "linux" }[platform];
    if (!prefix || !["x64", "arm64"].includes(arch)) return null;
    const target = `${prefix}-${arch}`;
    versionParts(release.tag_name);
    // Older feeds derived the display label from the fourth numeric component.
    const label = release.display_version ?? `Opt-${versionParts(release.tag_name)[3] || 0}`;
    const canonical = assetName(target, release.tag_name, portable, label);
    const legacySuffix = (portable ? legacyPortable : legacyInstallers)[target];
    const assets = Array.isArray(release.assets) ? release.assets : [];
    // The exact published name wins; legacy names remain compatible with older tags.
    const candidates = [...assets.filter(asset => asset.name === canonical), ...assets.filter(asset => asset.name !== canonical)];
    return candidates.find(asset => {
        if (typeof asset.name !== "string" || !asset.name.startsWith("Clash.for.Windows")
            || (asset.name !== canonical && !legacySuffix.test(asset.name))) return false;
        // Feed data cannot redirect the client to an arbitrary executable host or tag.
        return asset.browser_download_url === assetUrl(asset.name, release.tag_name);
    }) || null;
}

module.exports = { selectReleaseAsset };
