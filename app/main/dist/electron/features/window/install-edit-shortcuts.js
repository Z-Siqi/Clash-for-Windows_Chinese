"use strict";

function installEditShortcuts(webContents, platform = process.platform) {
    webContents.on("before-input-event", function(event, input) {
        if (input.type !== "keyDown" || input.alt || input.shift || input.isAutoRepeat) return;
        const primaryModifier = platform === "darwin" ? input.meta : input.control;
        if (!primaryModifier || String(input.key).toLowerCase() !== "v") return;
        // Electron 44 can miss the regular paste accelerator in embedded editors.
        event.preventDefault();
        webContents.paste();
    });
}

module.exports = { installEditShortcuts };
