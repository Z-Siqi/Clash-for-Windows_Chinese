"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { getMonacoRuntime } = require("../../main/dist/electron/entry/renderer/monaco-runtime");

const root = path.resolve(__dirname, "../../..");
const electronRoot = path.join(root, "app/main/dist/electron");
const generatedRoot = path.join(root, "app/build/generated/monaco");

function sha256(file) {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function relativeFiles(directory, base = directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? relativeFiles(target, base) : [path.relative(base, target).replace(/\\/g, "/")];
    });
}

test("Monaco is a pinned build-time dependency loaded before the renderer", () => {
    const packageJson = require(path.join(root, "package.json"));
    const lockfile = require(path.join(root, "package-lock.json"));
    const html = fs.readFileSync(path.join(electronRoot, "index.html"), "utf8");
    const preload = fs.readFileSync(path.join(electronRoot, "preload.js"), "utf8");
    const loader = fs.readFileSync(path.join(electronRoot, "entry/renderer/preload-loader.js"), "utf8");
    const renderer = fs.readFileSync(path.join(electronRoot, "renderer.js"), "utf8");
    const sharedComponents = fs.readFileSync(path.join(electronRoot, "entry/renderer/create-shared-components.js"), "utf8");

    assert.equal(packageJson.devDependencies["monaco-editor"], "0.57.0");
    assert.equal(packageJson.devDependencies.esbuild, "0.28.2");
    assert.equal(lockfile.packages["node_modules/monaco-editor"].version, "0.57.0");
    assert.ok(lockfile.packages["node_modules/monaco-editor"].integrity);
    assert.match(html, /generated\/monaco\/monaco\.css/);
    assert.doesNotMatch(html, /generated\/monaco\/monaco\.js|renderer\.js/);
    assert.match(preload, /createPreloadLoader/);
    assert.ok(loader.indexOf('"monaco.js"') < loader.indexOf('"renderer.js"'));
    assert.match(loader, /__CFW_RENDERER_ASSET_BASE__/);
    assert.match(sharedComponents, /getMonacoRuntime\(windowObject\)/);
    assert.doesNotMatch(renderer, /\bi\(\d+\)|vendor\/monaco-runtime/);
    assert.doesNotMatch(renderer, /^\s*\d+:\s*/m);
    assert.equal(fs.existsSync(path.join(electronRoot, "vendor/monaco-runtime.js")), false);
    assert.equal(fs.existsSync(path.join(electronRoot, "editor.worker.js")), false);
});

test("generated Monaco assets have a complete auditable manifest and browser-only boundary", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(generatedRoot, "manifest.json"), "utf8"));
    const lockfile = require(path.join(root, "package-lock.json"));
    assert.deepEqual({ package: manifest.package, version: manifest.version, integrity: manifest.integrity }, {
        package: "monaco-editor",
        version: "0.57.0",
        integrity: lockfile.packages["node_modules/monaco-editor"].integrity
    });
    assert.deepEqual(manifest.bundledDependencies, { dompurify: "3.4.15", marked: "14.0.0" });
    assert.equal(manifest.builder, "esbuild@0.28.2");
    for (const [relative, expected] of Object.entries(manifest.files)) {
        const file = path.join(generatedRoot, relative);
        assert.equal(fs.existsSync(file), true, relative);
        assert.equal(`sha256:${sha256(file)}`, expected, relative);
    }
    const actualFiles = relativeFiles(generatedRoot).filter(relative => relative !== "manifest.json").sort();
    assert.deepEqual(actualFiles, Object.keys(manifest.files).sort());
    for (const required of ["monaco.js", "monaco.css", "editor.worker.js", "LICENSE.monaco.txt", "ThirdPartyNotices.monaco.txt"])
        assert.ok(required in manifest.files, required);

    const runtime = fs.readFileSync(path.join(generatedRoot, "monaco.js"), "utf8");
    assert.match(runtime, /__CFW_MONACO__/);
    assert.match(runtime, /editor\.worker\.js/);
    assert.doesNotMatch(runtime, /\brequire\s*\(|from\s+["']electron["']|\bprocess\.(?:env|platform|versions)\b/);
});

test("every packaging target delegates to the lock-safe build pipeline", () => {
    const scripts = fs.readdirSync(path.join(root, "app")).filter(name => /^build_.+\.ps1$/.test(name));
    assert.deepEqual(scripts.sort(), ["build_linux_arm64.ps1", "build_linux_x64.ps1", "build_win32-ia32.ps1", "build_win32_arm64.ps1", "build_win_x64.ps1"]);
    for (const name of scripts) {
        const source = fs.readFileSync(path.join(root, "app", name), "utf8");
        assert.match(source, /npm --prefix \$repoRoot run package:/, name);
    }
    const packager = fs.readFileSync(path.join(root, "scripts/build/package-application.js"), "utf8");
    const packageJson = require(path.join(root, "package.json"));
    assert.match(packageJson.scripts["package:mac-x64"], /package-application\.js mac-x64/);
    assert.match(packageJson.scripts["package:mac-arm64"], /package-application\.js mac-arm64/);
    assert.match(packageJson.scripts["package:dmg:mac-x64"], /package-dmg\.js mac-x64/);
    assert.match(packageJson.scripts["package:dmg:mac-arm64"], /package-dmg\.js mac-arm64/);
    assert.match(packager, /buildMonaco\(\)/);
    assert.match(packager, /createBuildId\(\)/);
    assert.match(packager, /overwrite: false/);
    assert.match(packager, /afterCopy: \[\(\{ buildPath \}\) =>/);
    assert.match(packager, /path\.join\(sourceRoot, "dist", "electron", "static"\)/);
    assert.match(packager, /"Contents", "Resources"/);
    assert.match(packager, /resolvePackagedResourcesRoot\(outputPath, target\)/);
    assert.match(packager, /"mac-x64"/);
    assert.match(packager, /"mac-arm64"/);
    assert.match(packager, /platform: "darwin"/);
    assert.match(packager, /appBundleId: "com\.lbyczf\.clashwin"/);
    assert.match(packager, /appCategoryType: "public\.app-category\.utilities"/);
    assert.match(packager, /path\.join\(applicationRoot, "icon\.icns"\)/);
    assert.match(packager, /target\.requiredFiles \|\| \[\]/);
    assert.match(packager, /target\.executableFiles \|\| \[\]/);
    assert.match(packager, /fs\.chmodSync\(path\.join\(packagedStaticRoot, relative\), 0o755\)/);
    assert.match(packager, /must be packaged on a/);
    assert.match(packager, /CFW_CODESIGN_IDENTITY/);
    assert.doesNotMatch(packager, /rmSync\([^\n]*packages/);

    const dmg = fs.readFileSync(path.join(root, "scripts/build/package-dmg.js"), "utf8");
    assert.match(dmg, /fs\.symlinkSync\("\/Applications"/);
    assert.match(dmg, /\.VolumeIcon\.icns/);
    assert.match(dmg, /"SetFile"/);
    assert.match(dmg, /"-format", "UDRW"/);
    assert.match(dmg, /"attach", "-readwrite"/);
    assert.match(dmg, /"convert", writableImage/);
    assert.match(dmg, /"-format", "UDZO"/);
    assert.match(dmg, /"-fs", "HFS\+"/);
    assert.match(dmg, /latest-dmg\.json/);
    assert.match(dmg, /os\.tmpdir\(\)/);
    assert.match(dmg, /"codesign"/);
    assert.match(dmg, /CFW_CODESIGN_IDENTITY/);
});

test("native default build wrappers detect supported architectures and pause before exit", () => {
    const windows = fs.readFileSync(path.join(root, "app/build_default.bat"), "utf8");
    assert.match(windows, /PROCESSOR_ARCHITEW6432/);
    assert.match(windows, /PROCESSOR_ARCHITECTURE/);
    assert.match(windows, /build_win_x64\.ps1/);
    assert.match(windows, /build_win32-ia32\.ps1/);
    assert.match(windows, /build_win32_arm64\.ps1/);
    assert.match(windows, /pause/);
    assert.match(windows, /exit \/b %BUILD_EXIT_CODE%/);

    const posix = fs.readFileSync(path.join(root, "app/build_default.sh"), "utf8");
    assert.match(posix, /^#!\/usr\/bin\/env bash/);
    assert.match(posix, /uname -s/);
    assert.match(posix, /Linux:x86_64\|Linux:amd64/);
    assert.match(posix, /Linux:aarch64\|Linux:arm64/);
    assert.match(posix, /Darwin:x86_64\|Darwin:amd64/);
    assert.match(posix, /Darwin:aarch64\|Darwin:arm64/);
    assert.match(posix, /hw\.optional\.arm64/);
    assert.match(posix, /package:linux-x64/);
    assert.match(posix, /package:linux-arm64/);
    assert.match(posix, /package:mac-x64/);
    assert.match(posix, /package:mac-arm64/);
    assert.match(posix, /read -r -n 1 -s/);
    assert.match(posix, /pause_and_exit "\$BUILD_EXIT_CODE"/);
});

test("renderer rejects a missing or incomplete Monaco browser runtime", () => {
    assert.throws(() => getMonacoRuntime({}), /did not load before renderer\.js/);
    const monaco = { editor: { create() {} }, languages: { registerCompletionItemProvider() {} } };
    assert.equal(getMonacoRuntime({ __CFW_MONACO__: monaco }), monaco);
});
