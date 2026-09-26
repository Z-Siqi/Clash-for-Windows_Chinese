"use strict";

function createPlatform({ platform, arch }) {
    const targets = {
        windowsX64: Symbol(), windowsX86: Symbol(), windowsArm: Symbol(), windowsArm64: Symbol(),
        macX64: Symbol(), macArm64: Symbol(), linuxX64: Symbol(), linuxArm64: Symbol(), unknown: Symbol()
    };
    const target = ({
        win32: { x64: targets.windowsX64, ia32: targets.windowsX86, arm: targets.windowsArm, arm64: targets.windowsArm64 },
        darwin: { x64: targets.macX64, arm64: targets.macArm64 },
        linux: { x64: targets.linuxX64, arm64: targets.linuxArm64 }
    }[platform] || {})[arch] || targets.unknown;
    return {
        ...targets, current: () => target,
        // Existing ARM32 packages use the Windows x86 assets.
        assetTarget: () => target === targets.windowsArm ? targets.windowsX86 : target,
        isWindows: () => [targets.windowsX64, targets.windowsX86, targets.windowsArm, targets.windowsArm64].includes(target),
        isMacOS: () => [targets.macX64, targets.macArm64].includes(target),
        isLinux: () => [targets.linuxX64, targets.linuxArm64].includes(target)
    };
}

module.exports = { createPlatform };
