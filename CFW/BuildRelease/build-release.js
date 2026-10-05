"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const release = require("../../app/main/dist/electron/core/release/release-info");
const { createTarGz, createDeb } = require("./linux-packages");
const { synchronizeRelease } = require("../../scripts/build/sync-release");

const root = path.resolve(__dirname, "../..");
const allTargets = ["win-x64", "win-arm64", "linux-x64", "linux-arm64", "mac-x64", "mac-arm64"];

function planTargets(platform, requested) {
    const available = allTargets.filter(target => target.startsWith("linux-")
        || platform === "win32" && target.startsWith("win-")
        || platform === "darwin" && target.startsWith("mac-"));
    const targets = requested || available;
    if (!targets.length || new Set(targets).size !== targets.length || targets.some(target => !allTargets.includes(target))) {
        throw new Error(`Expected unique targets from: ${allTargets.join(", ")}`);
    }
    const unsupported = targets.filter(target => !available.includes(target));
    if (unsupported.length) throw new Error(`Targets require another host: ${unsupported.join(", ")}. Windows installers require Windows/Inno Setup; macOS DMGs require macOS.`);
    return { targets, skipped: allTargets.filter(target => !targets.includes(target)) };
}

function resolveContained(base, relative) {
    const resolved = path.resolve(base, relative);
    if (!resolved.startsWith(path.resolve(base) + path.sep)) throw new Error("Build metadata points outside its output directory");
    return resolved;
}

function findIscc() {
    const locations = [process.env.ISCC_PATH];
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]) {
        if (base) for (const version of [7, 6]) locations.push(path.join(base, `Inno Setup ${version}`, "ISCC.exe"));
    }
    const found = locations.find(file => file && fs.existsSync(file));
    if (found) return found;
    const search = spawnSync("where.exe", ["ISCC.exe"], { encoding: "utf8", windowsHide: true });
    const result = search.stdout?.trim().split(/\r?\n/)[0];
    if (result && fs.existsSync(result)) return result;
    throw new Error("Inno Setup 6.3+ is required. Set ISCC_PATH to ISCC.exe.");
}

function verifyWindowsArchitecture(packagePath, arch) {
    const descriptor = fs.openSync(path.join(packagePath, `${release.config.productName}.exe`), "r");
    try {
        const header = Buffer.alloc(64); fs.readSync(descriptor, header, 0, 64, 0);
        const signature = Buffer.alloc(6); fs.readSync(descriptor, signature, 0, 6, header.readUInt32LE(60));
        const expected = arch === "arm64" ? 0xaa64 : 0x8664;
        if (header.toString("ascii", 0, 2) !== "MZ" || signature.readUInt32LE(0) !== 0x4550 || signature.readUInt16LE(4) !== expected) {
            throw new Error(`Packaged application does not match Windows ${arch}`);
        }
    } finally { fs.closeSync(descriptor); }
}

async function sha256(file) {
    const hash = crypto.createHash("sha256");
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    return hash.digest("hex");
}

function seedElectronCache(destination) {
    fs.mkdirSync(destination, { recursive: true });
    // Reuse already downloaded runtime ZIPs; new cache files stay with release builds.
    const source = process.env.ELECTRON_CACHE || (process.platform === "win32" && process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "electron/Cache") : null);
    if (!source || !fs.existsSync(source) || path.resolve(source) === path.resolve(destination)) return;
    for (const folder of fs.readdirSync(source, { withFileTypes: true })) {
        if (!folder.isDirectory()) continue;
        for (const file of fs.readdirSync(path.join(source, folder.name))) {
            if (!file.startsWith(`electron-v${release.config.electronVersion}-`) || !file.endsWith(".zip")) continue;
            const target = path.join(destination, folder.name, file);
            if (fs.existsSync(target)) continue;
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(path.join(source, folder.name, file), target);
        }
    }
}

async function main(args = process.argv.slice(2)) {
    const targetsArgument = args.find(argument => argument.startsWith("--targets="));
    if (args.some(argument => !["--plan", "--all", "--skip-tests"].includes(argument) && !argument.startsWith("--targets="))) throw new Error("Unknown option");
    if (targetsArgument && args.includes("--all")) throw new Error("Choose --all or --targets");
    const plan = planTargets(process.platform, args.includes("--all") ? allTargets : targetsArgument?.slice(10).split(","));
    if (args.includes("--plan")) { console.log(JSON.stringify(plan, null, 2)); return; }
    const iscc = plan.targets.some(target => target.startsWith("win-")) ? findIscc() : null;
    const sevenZip = process.env.CFW_7ZIP || "7z";
    if (plan.targets.some(target => /^(win|mac)-/.test(target))) {
        const probe = spawnSync(sevenZip, ["i"], { stdio: "ignore", windowsHide: true });
        if (probe.error || probe.status !== 0) throw new Error("7-Zip/NanaZip CLI is required; set CFW_7ZIP or put 7z in PATH.");
    }
    synchronizeRelease();
    const id = `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${process.pid}`;
    const runRoot = path.join(__dirname, "Build", release.config.version, id);
    const work = path.join(runRoot, "work"), artifacts = path.join(__dirname, "Build", "Output", release.config.version, id), temporary = path.join(runRoot, "temp");
    for (const folder of [work, artifacts, temporary, path.join(runRoot, "logs")]) fs.mkdirSync(folder, { recursive: true });
    const cache = path.join(__dirname, "Build/cache/electron");
    seedElectronCache(cache);
    const env = { ...process.env, CFW_BUILD_ROOT: work, CFW_ELECTRON_CACHE: cache, TEMP: temporary, TMP: temporary, TMPDIR: temporary };
    const manifest = { version: release.config.version, host: process.platform, targets: plan.targets, skipped: plan.skipped, artifacts: [], status: "building" };
    const manifestPath = path.join(runRoot, "manifest.json");
    const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    let sequence = 0;
    const run = (command, commandArgs, label, cwd = root) => {
        console.log(label);
        const log = path.join(runRoot, "logs", `${++sequence}-${label.replace(/[^a-z0-9-]/gi, "-")}.log`);
        const descriptor = fs.openSync(log, "w");
        let result;
        try { result = spawnSync(command, commandArgs, { cwd, env, windowsHide: true, stdio: ["ignore", descriptor, descriptor] }); }
        finally { fs.closeSync(descriptor); }
        if (result.error || result.status !== 0) throw new Error(`${label} failed; see ${log}: ${result.error?.message || result.status}`);
    };
    const record = async (target, file, kind) => {
        manifest.artifacts.push({ target, kind, name: path.basename(file), size: fs.statSync(file).size, sha256: await sha256(file) });
        save();
    };
    save();
    try {
        if (!args.includes("--skip-tests")) {
            run(process.execPath, ["scripts/build/build-monaco.js"], "Build Monaco");
            run(process.execPath, ["scripts/build/build-renderer.js"], "Build renderer");
            run(process.execPath, ["scripts/run-test-group.js", "all"], "Tests");
        }
        for (const target of plan.targets) {
            if (target.startsWith("mac-")) run(process.execPath, ["scripts/build/package-dmg.js", target], `Package ${target} DMG`);
            else run(process.execPath, ["scripts/build/package-application.js", target], `Package ${target}`);
            const targetRoot = path.join(work, "packages", target);
            const latest = JSON.parse(fs.readFileSync(path.join(targetRoot, "latest.json"), "utf8"));
            // package-application records paths relative to app; resolve then constrain them.
            const packagePath = resolveContained(work, path.relative(work, path.resolve(root, "app", latest.outputPath)));
            if (target.startsWith("win-")) {
                const arch = target.split("-")[1];
                verifyWindowsArchitecture(packagePath, arch);
                run(iscc, ["/Qp", `/DBuildSource=${packagePath}`, `/DBuildOutput=${artifacts}`, `/DTargetArch=${arch}`, path.join(__dirname, "InnoSetup/packing_script.iss")], `Installer ${target}`);
                await record(target, path.join(artifacts, release.assetName(target)), "installer");
            } else if (target.startsWith("mac-")) {
                const dmg = JSON.parse(fs.readFileSync(path.join(targetRoot, "latest-dmg.json"), "utf8"));
                const source = resolveContained(work, path.relative(work, path.resolve(root, "app", dmg.dmgPath)));
                const destination = path.join(artifacts, release.assetName(target));
                fs.copyFileSync(source, destination); await record(target, destination, "diskImage");
            } else {
                const archive = path.join(artifacts, release.assetName(target));
                await createTarGz(packagePath, archive, { prefix: path.basename(packagePath) });
                await record(target, archive, "portable");
                const deb = path.join(artifacts, `Clash.for.Windows-${release.config.version}-${target}.deb`);
                await createDeb({ packagePath, target, version: release.config.version, output: deb, staging: path.join(runRoot, "staging", target), applicationId: release.config.applicationId });
                await record(target, deb, "deb");
                continue;
            }
            const archive = path.join(artifacts, release.assetName(target, release.config.version, true));
            // macOS frameworks use symlinks that must survive portable archiving.
            const archiveOptions = target.startsWith("mac-") ? ["-snl"] : [];
            run(sevenZip, ["a", "-t7z", "-mx=5", "-mmt=2", ...archiveOptions, archive, path.basename(packagePath)], `Portable ${target}`, path.dirname(packagePath));
            await record(target, archive, "portable");
        }
        fs.writeFileSync(path.join(artifacts, "SHA256SUMS"), manifest.artifacts.map(asset => `${asset.sha256}  ${asset.name}`).join("\n") + "\n");
        const feed = release.createUpdateFeed({ targets: [] });
        feed.assets = manifest.artifacts.map(asset => ({ name: asset.name, browser_download_url: release.assetUrl(asset.name) }));
        fs.writeFileSync(path.join(artifacts, "update"), JSON.stringify(feed, null, 2) + "\n");
        manifest.status = "complete"; save();
        fs.writeFileSync(path.join(__dirname, "Build/latest.json"), JSON.stringify({ runRoot, artifacts, manifestPath }, null, 2) + "\n");
        console.log(`Release artifacts: ${artifacts}`);
        if (plan.skipped.length) console.log(`Not built on this run: ${plan.skipped.join(", ")}`);
    } catch (error) { manifest.status = "failed"; manifest.error = error.message; save(); throw error; }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { planTargets, resolveContained, verifyWindowsArchitecture, main };
