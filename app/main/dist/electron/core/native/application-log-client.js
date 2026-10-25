"use strict";

function createApplicationLogClient({ ipcRenderer }) {
    return Object.fromEntries(["info", "warn", "error"].map(level => [level, (...messages) => {
        ipcRenderer.send("application-log-write", level, messages.map(message => String(message).slice(0, 8192)).slice(0, 8));
    }]));
}

module.exports = { createApplicationLogClient };
