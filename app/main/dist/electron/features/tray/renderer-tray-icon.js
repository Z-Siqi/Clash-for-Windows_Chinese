"use strict";

function getRendererTrayIcon({ path, staticRoot, clashPath = "", settings = {}, isTun, isMixin, enabled, mode = "rule" }) {
    const active = enabled || isTun || isMixin;
    if (settings.useModeIcons) return path.join(staticRoot, "tray", "win", `${active ? "on" : "off"}_${mode}.png`);
    const custom = active ? settings.iconSystemProxy : settings.iconDefault;
    if (custom) return path.isAbsolute(custom) ? custom : path.join(clashPath, custom);
    let color = "normal";
    if (active) {
        color = isTun && isMixin && enabled ? "orange"
            : isTun && enabled ? "green"
            : isMixin && enabled ? "light_blue"
            : isTun && isMixin ? "brown"
            : isTun ? "pink" : isMixin ? "purple" : "reverse";
    }
    return path.join(staticRoot, "tray", "win", `tray_${color}.ico`);
}

module.exports = { getRendererTrayIcon };
