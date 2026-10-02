"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const esbuild = require("esbuild");

async function main() {
    const root = path.resolve(__dirname, "../..");
    const version = require("esbuild/package.json").version;
    if (version !== "0.28.2") throw new Error("Unexpected renderer builder version");
    const output = path.join(root, "app/build/generated/renderer");
    fs.mkdirSync(output, { recursive: true });
    const result = await esbuild.build({
        entryPoints: [path.join(root, "app/main/dist/electron/renderer.js")],
        bundle: true, platform: "browser", target: ["chrome120"], format: "iife",
        minify: true, write: false, metafile: true,
        define: { "process.env": "{}", global: "globalThis" },
        plugins: [{ name: "isolated-electron-host", setup(build) {
            build.onResolve({ filter: /^electron$/ }, () => ({ path: "electron", namespace: "isolated-host" }));
            build.onLoad({ filter: /.*/, namespace: "isolated-host" }, () => ({ contents: "module.exports = globalThis.__CFW_HOST__.electron;", loader: "js" }));
        } }]
    });
    // Browser mode rejects Node built-ins rather than silently replacing native APIs.
    const content = result.outputFiles[0].contents;
    fs.writeFileSync(path.join(output, "renderer.js"), content);
    fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify({
        builder: `esbuild@${version}`, sha256: crypto.createHash("sha256").update(content).digest("hex"),
        inputs: Object.keys(result.metafile.inputs).sort()
    }, null, 2) + "\n");
    console.log(`Browser renderer: built ${content.length} bytes without Node built-ins`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
