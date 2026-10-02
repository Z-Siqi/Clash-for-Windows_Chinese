"use strict";

// Sandboxed preloads may require Electron, but cannot load Node or application modules.
const { ipcRenderer, webFrame } = require("electron");

webFrame.setIsolatedWorldInfo(999, {
    securityOrigin: "cfw-preload://renderer",
    csp: "default-src 'self' file: data: blob: http: https: ws:; script-src 'self' file:; style-src 'self' 'unsafe-inline' file:; img-src 'self' data: file: https:; font-src 'self' data: file:; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; worker-src 'self' blob: file:; object-src 'none'; base-uri 'none'",
    name: "CFW sandboxed renderer"
});

// This object remains inside the isolated world; the page receives no bridge.
Object.defineProperty(globalThis, "__CFW_HOST__", {
    value: Object.freeze({ electron: Object.freeze({ ipcRenderer }), rendererSandboxed: process.sandboxed === true }),
    configurable: false,
    writable: false
});
