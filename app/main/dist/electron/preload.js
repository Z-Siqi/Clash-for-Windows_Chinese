"use strict";

const path = require("path");
const { pathToFileURL } = require("url");
const { webFrame } = require("electron");
const { createPreloadLoader } = require("./entry/renderer/preload-loader");
const { configureRendererTransports } = require("./entry/renderer/configure-transports");

const packagedMonacoDirectory = path.join(__dirname, "generated", "monaco");
const sourceMonacoDirectory = path.resolve(__dirname, "../../../build/generated/monaco");
const monacoDirectory = require("fs").existsSync(packagedMonacoDirectory)
    ? packagedMonacoDirectory
    : sourceMonacoDirectory;
const packagedStaticDirectory = path.join(process.resourcesPath, "static");
const staticDirectory = require("fs").existsSync(packagedStaticDirectory)
    ? packagedStaticDirectory
    : path.join(__dirname, "static");

// Keep eval-dependent legacy CommonJS code out of the page's main-world CSP.
webFrame.setIsolatedWorldInfo(999, {
    securityOrigin: "cfw-preload://renderer",
    csp: "default-src 'self' file: data: blob: http: https: ws:; script-src 'self' 'unsafe-eval' file:; style-src 'self' 'unsafe-inline' file:; img-src 'self' data: file: https:; font-src 'self' data: file:; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; worker-src 'self' blob: file:; object-src 'none'; base-uri 'none'",
    name: "CFW isolated renderer"
});

configureRendererTransports({ axios: require("axios") });

createPreloadLoader({
    globalObject: globalThis,
    documentObject: document,
    dirname: __dirname,
    monacoDirectory,
    staticDirectory,
    path,
    pathToFileURL,
    loadModule: require
});
