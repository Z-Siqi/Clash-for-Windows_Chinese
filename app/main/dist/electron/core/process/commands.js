"use strict";

// Network and process tools can stall while Windows removes an adapter. Bound
// their execution without blocking Electron's main event loop.
const defaults = { windowsHide: true, timeout: 5000, maxBuffer: 1048576 };

function execFileAsync(childProcess, file, args, options = {}) {
    return new Promise((resolve, reject) => {
        childProcess.execFile(file, args, { ...defaults, ...options }, (error, stdout) => error ? reject(error) : resolve(stdout || ""));
    });
}

function execAsync(childProcess, command, options = {}) {
    return new Promise((resolve, reject) => {
        childProcess.exec(command, { ...defaults, ...options }, (error, stdout) => error ? reject(error) : resolve(stdout || ""));
    });
}

module.exports = { execFileAsync, execAsync };
