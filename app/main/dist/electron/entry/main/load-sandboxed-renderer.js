"use strict";

function installSandboxedRenderer({ window, fs, path, crypto, pathToFileURL, dirname, staticRoot, platform, arch, cwd }) {
    const packaged = path.join(dirname, "generated");
    const generated = fs.existsSync(path.join(packaged, "renderer", "manifest.json")) ? packaged : path.resolve(dirname, "../../../build/generated");
    window.webContents.on("dom-ready", async () => {
        try {
            const renderer = fs.readFileSync(path.join(generated, "renderer", "renderer.js"), "utf8");
            const manifest = JSON.parse(fs.readFileSync(path.join(generated, "renderer", "manifest.json"), "utf8"));
            if (crypto.createHash("sha256").update(renderer).digest("hex") !== manifest.sha256) throw new Error("Renderer asset integrity check failed");
            const monaco = fs.readFileSync(path.join(generated, "monaco", "monaco.js"), "utf8");
            const metadata = { platform, arch, cwd, staticRoot: path.resolve(staticRoot),
                monacoBase: pathToFileURL(path.join(generated, "monaco") + path.sep).href,
                rendererBase: pathToFileURL(dirname + path.sep).href };
            const bootstrap = `(() => {
                const metadata = ${JSON.stringify(metadata)};
                const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: false, writable: false });
                define('__CFW_BOOTSTRAP__', metadata);
                define('__static', metadata.staticRoot);
                define('__CFW_MONACO_ASSET_BASE__', metadata.monacoBase);
                define('__CFW_RENDERER_ASSET_BASE__', metadata.rendererBase);
                if (!globalThis.customElements) {
                    const definitions = new Map();
                    define('customElements', { define(name, constructor) { definitions.set(name, constructor); }, get(name) { return definitions.get(name); } });
                }
            })();`;
            // Only these fixed, locally-built assets execute in the private preload world.
            // No renderer message can submit source code or choose a script path.
            await window.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: bootstrap + "\n" + monaco + "\n" + renderer }]);
        } catch (error) {
            console.error("Failed to initialize sandboxed renderer", error.message);
        }
    });
}

module.exports = { installSandboxedRenderer };
