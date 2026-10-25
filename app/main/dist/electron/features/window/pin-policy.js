"use strict";

function supportsWindowPin({ platform, ozonePlatform = "", env = {} }) {
    if (platform !== "linux") return true;
    // Respect Xwayland explicitly selected inside a Wayland desktop. Electron's
    // native Wayland backend cannot implement setAlwaysOnTop.
    if (ozonePlatform === "x11") return true;
    if (ozonePlatform && ozonePlatform !== "auto") return false;
    if (env.XDG_SESSION_TYPE === "wayland" || env.WAYLAND_DISPLAY) return false;
    return Boolean(env.DISPLAY);
}

module.exports = { supportsWindowPin };
