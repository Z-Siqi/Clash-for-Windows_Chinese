"use strict";

function registerPowerMonitor({ powerMonitor, getMainWindow }) {
    powerMonitor.on("suspend", function() {
        getMainWindow().webContents.send("power-event", "suspend");
    });
    powerMonitor.on("resume", function() {
        getMainWindow().webContents.send("power-event", "resume");
    });
}

module.exports = { registerPowerMonitor };
