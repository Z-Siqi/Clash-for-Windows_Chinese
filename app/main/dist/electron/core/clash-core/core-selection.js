"use strict";

const CORE_TYPES = Object.freeze({
    CLASH: "clash",
    MIHOMO: "mihomo"
});

const TARGETS = Object.freeze({
    "win32:ia32": { directory: ["win", "ia32"], clash: "clash-win32.exe", mihomo: "mihomo-windows-386.exe" },
    "win32:x64": { directory: ["win", "x64"], clash: "clash-win64.exe", mihomo: "mihomo-windows-amd64.exe" },
    "win32:arm64": { directory: ["win", "arm64"], clash: "clash-win-arm64.exe", mihomo: "mihomo-windows-arm64.exe" },
    "darwin:x64": { directory: ["darwin", "x64"], clash: "clash-darwin", mihomo: "mihomo-darwin-amd64" },
    "darwin:arm64": { directory: ["darwin", "arm64"], clash: "clash-darwin", mihomo: "mihomo-darwin-arm64" },
    "linux:x64": { directory: ["linux", "x64"], clash: "clash-linux", mihomo: "mihomo-linux-amd64" },
    "linux:arm64": { directory: ["linux", "arm64"], clash: "clash-linux", mihomo: "mihomo-linux-arm64" }
});

function normalizeCoreType(value) {
    return value === CORE_TYPES.MIHOMO ? CORE_TYPES.MIHOMO : CORE_TYPES.CLASH;
}

function resolveCoreBinaryPath({ path, filesPath, platform = process.platform, arch = process.arch, coreType }) {
    const target = TARGETS[`${platform}:${arch}`];
    if (!target) throw new Error(`Unsupported core target: ${platform}/${arch}`);
    const selectedCore = normalizeCoreType(coreType);
    return path.join(filesPath, ...target.directory, target[selectedCore]);
}

function getCoreDisplayName(coreType) {
    return normalizeCoreType(coreType) === CORE_TYPES.MIHOMO ? "Mihomo" : "Clash";
}

module.exports = { CORE_TYPES, normalizeCoreType, resolveCoreBinaryPath, getCoreDisplayName };
