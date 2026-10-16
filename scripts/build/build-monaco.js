"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "../..");
const buildRoot = path.resolve(process.env.CFW_BUILD_ROOT || path.join(root, "app/build"));
const outputDirectory = path.join(buildRoot, "generated/monaco");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-monaco-"));
const monacoPackagePath = path.join(root, "node_modules/monaco-editor/package.json");
const monacoRoot = path.dirname(monacoPackagePath);
const monacoPackage = JSON.parse(fs.readFileSync(monacoPackagePath, "utf8"));
const lockfile = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const lockedPackage = lockfile.packages?.["node_modules/monaco-editor"];
const lockedDomPurify = lockfile.packages?.["node_modules/dompurify"];
const lockedMarked = lockfile.packages?.["node_modules/marked"];
const lockedEsbuild = lockfile.packages?.["node_modules/esbuild"];
const domPurifyPackage = JSON.parse(fs.readFileSync(path.join(root, "node_modules/dompurify/package.json"), "utf8"));
const embeddedSanitizer = path.join(monacoRoot, "esm/vs/base/browser/dompurify/dompurify.js");
const patchedSanitizer = path.join(root, "node_modules/dompurify/dist/purify.es.mjs");

if (monacoPackage.version !== "0.57.0" || lockedPackage?.version !== monacoPackage.version) {
    throw new Error(`Expected locked monaco-editor 0.57.0, found ${lockedPackage?.version || "missing"}`);
}
if (!lockedPackage.integrity) throw new Error("The Monaco lockfile entry has no integrity hash");
// Monaco pins an older sanitizer; the repository override supplies its security fixes.
if (monacoPackage.dependencies?.dompurify !== "3.4.15" || lockedDomPurify?.version !== "3.4.17"
    || domPurifyPackage.version !== lockedDomPurify.version || !lockedDomPurify.integrity) {
    throw new Error(`Unexpected locked DOMPurify version: ${lockedDomPurify?.version || "missing"}`);
}
if (monacoPackage.dependencies?.marked !== "14.0.0" || lockedMarked?.version !== "14.0.0" || !lockedMarked.integrity) {
    throw new Error(`Unexpected locked marked version: ${lockedMarked?.version || "missing"}`);
}
if (lockedEsbuild?.version !== "0.28.2" || !lockedEsbuild.integrity || require("esbuild/package.json").version !== "0.28.2") {
    throw new Error(`Unexpected locked esbuild version: ${lockedEsbuild?.version || "missing"}`);
}

const common = {
    absWorkingDir: root,
    bundle: true,
    platform: "browser",
    target: ["chrome120"],
    minify: true,
    sourcemap: false,
    legalComments: "eof",
    logLevel: "warning",
    define: {
        process: "undefined"
    },
    loader: {
        ".ttf": "file",
        ".woff": "file",
        ".woff2": "file",
        ".svg": "file",
        ".png": "file"
    },
    assetNames: "assets/[name]-[hash]",
    plugins: [{
        name: "patched-monaco-sanitizer",
        setup(build) {
            // Monaco embeds a separate copy; an npm override alone cannot replace it.
            build.onResolve({ filter: /^\.\/dompurify\/dompurify\.js$/ }, args => {
                if (path.resolve(args.resolveDir, args.path) === embeddedSanitizer) {
                    return { path: patchedSanitizer };
                }
            });
        }
    }]
};

function filesIn(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? filesIn(target) : [target];
    });
}

function sha256(file) {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function main() {
    try {
        const runtimeBuild = await esbuild.build({
            ...common,
            metafile: true,
            entryPoints: [path.join(root, "scripts/build/monaco-entry.js")],
            outfile: path.join(temporaryDirectory, "monaco.js")
        });
        const inputs = Object.keys(runtimeBuild.metafile.inputs).sort();
        const resolvedInputs = new Set(inputs.map(input => path.resolve(root, input)));
        if (!resolvedInputs.has(patchedSanitizer) || resolvedInputs.has(embeddedSanitizer)) {
            throw new Error("Monaco must bundle the patched DOMPurify package, not its embedded copy");
        }
        await esbuild.build({
            ...common,
            entryPoints: [path.join(monacoRoot, "esm/vs/editor/editor.worker.js")],
            outfile: path.join(temporaryDirectory, "editor.worker.js")
        });

        fs.copyFileSync(path.join(monacoRoot, "LICENSE"), path.join(temporaryDirectory, "LICENSE.monaco.txt"));
        fs.copyFileSync(path.join(monacoRoot, "ThirdPartyNotices.txt"), path.join(temporaryDirectory, "ThirdPartyNotices.monaco.txt"));
        fs.copyFileSync(path.join(root, "node_modules/dompurify/LICENSE"), path.join(temporaryDirectory, "LICENSE.dompurify.txt"));

        const files = Object.fromEntries(filesIn(temporaryDirectory)
            .map(file => [path.relative(temporaryDirectory, file).replace(/\\/g, "/"), `sha256:${sha256(file)}`])
            .sort(([left], [right]) => left.localeCompare(right)));
        const manifest = {
            package: "monaco-editor",
            version: monacoPackage.version,
            integrity: lockedPackage.integrity,
            bundledDependencies: {
                dompurify: lockedDomPurify.version,
                marked: monacoPackage.dependencies.marked
            },
            builder: "esbuild@0.28.2",
            inputs,
            files
        };
        fs.writeFileSync(path.join(temporaryDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

        const resolvedOutput = path.resolve(outputDirectory);
        const expectedParent = path.join(buildRoot, "generated");
        if (!resolvedOutput.startsWith(`${expectedParent}${path.sep}`)) {
            throw new Error(`Refusing to replace unexpected output directory: ${resolvedOutput}`);
        }
        fs.rmSync(resolvedOutput, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
        fs.cpSync(temporaryDirectory, resolvedOutput, { recursive: true });
        console.log(`Monaco ${monacoPackage.version}: built ${Object.keys(files).length} audited assets`);
    } finally {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
