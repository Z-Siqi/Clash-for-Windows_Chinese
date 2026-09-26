"use strict";

function createTrayIconController({
    nativeImage,
    platform = process.platform,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    settleDelayMs = 250
}) {
    let tray = null;
    let latestPath = "";
    let settleTimer = null;

    function loadImage(imagePath) {
        const image = nativeImage.createFromPath(imagePath);
        if (image && typeof image.isEmpty === "function" && image.isEmpty()) {
            throw new Error(`Tray image could not be loaded: ${imagePath}`);
        }
        return image;
    }

    function apply() {
        if (platform === "darwin" || !tray || !latestPath) return false;
        tray.setImage(loadImage(latestPath));
        return true;
    }

    function scheduleSettledApply() {
        // Windows Explorer can briefly retain the previous tray bitmap. A fresh
        // NativeImage after the state change avoids relying on its path cache.
        if (settleTimer !== null) clearTimeoutFn(settleTimer);
        settleTimer = setTimeoutFn(function() {
            settleTimer = null;
            try { apply(); } catch (_error) {}
        }, settleDelayMs);
        if (settleTimer && typeof settleTimer.unref === "function") settleTimer.unref();
    }

    function update(imagePath) {
        if (typeof imagePath !== "string" || imagePath.length === 0) return false;
        latestPath = imagePath;
        try {
            const applied = apply();
            if (applied) scheduleSettledApply();
            return applied;
        } catch (_error) {
            scheduleSettledApply();
            return false;
        }
    }

    function setTray(nextTray) {
        tray = nextTray || null;
        if (!tray) return;
        try {
            if (apply()) scheduleSettledApply();
        } catch (_error) {
            scheduleSettledApply();
        }
    }

    function dispose() {
        if (settleTimer !== null) clearTimeoutFn(settleTimer);
        settleTimer = null;
        tray = null;
    }

    return { update, setTray, dispose, getLatestPath: () => latestPath };
}

module.exports = { createTrayIconController };
