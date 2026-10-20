"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveCoreBinaryPath } = require("../../app/main/dist/electron/core/clash-core/core-selection");
const { downloadFile, extractBinary } = require("./mihomo-download");

const repositoryRoot = path.resolve(__dirname, "../..");
const manifestRelative = "app/clash_core/mihomo-core-manifest.json";
const targets = Object.freeze({
    "win-x64": { platform: "win32", arch: "x64", directory: "win_x64", asset: "windows-amd64-compatible", extension: "zip" },
    "win-arm64": { platform: "win32", arch: "arm64", directory: "win32-arm64", asset: "windows-arm64", extension: "zip" },
    "linux-x64": { platform: "linux", arch: "x64", directory: "linux-x64", asset: "linux-amd64-compatible", extension: "gz" },
    "linux-arm64": { platform: "linux", arch: "arm64", directory: "linux-arm64", asset: "linux-arm64", extension: "gz" },
    "mac-x64": { platform: "darwin", arch: "x64", directory: "darwin-x64", asset: "darwin-amd64-compatible", extension: "gz" },
    "mac-arm64": { platform: "darwin", arch: "arm64", directory: "darwin-arm64", asset: "darwin-arm64", extension: "gz" }
});

function validateVersion(version) {
    if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
        throw new Error("Expected an exact Mihomo version, for example 1.19.31");
    }
    const components = version.split(".").map(component => Number(component));
    const canonical = components.join(".");
    if (!components.every(Number.isSafeInteger) || canonical !== version) {
        throw new Error("Expected an exact canonical Mihomo version with safe integer components");
    }
    // Build request paths from numeric version components, never raw file data.
    return canonical;
}

function targetSpec(name, version) {
    const target = targets[name];
    if (!target) throw new Error(`Unsupported Mihomo target: ${name}`);
    version = validateVersion(version);
    const filesPath = `clash_core/${target.directory}/static/files`;
    const output = resolveCoreBinaryPath({ path: path.posix, filesPath, ...target, coreType: "mihomo" });
    const legacy = resolveCoreBinaryPath({ path: path.posix, filesPath, ...target, coreType: "clash" });
    const asset = `mihomo-${target.asset}-v${version}.${target.extension}`;
    return {
        name, ...target, asset, output, legacy,
        source: `https://github.com/MetaCubeX/mihomo/releases/download/v${version}/${asset}`,
        notice: `${filesPath}/MIHOMO_NOTICE.txt`,
        serviceManifest: `${path.posix.dirname(output)}/service/core-hashes.json`
    };
}

function readManifest(root = repositoryRoot) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestRelative), "utf8").replace(/^\uFEFF/, ""));
    validateVersion(manifest.version);
    if (manifest.project !== "MetaCubeX/mihomo"
        || manifest.release !== `https://github.com/MetaCubeX/mihomo/releases/tag/v${manifest.version}`
        || !Array.isArray(manifest.targets) || manifest.targets.length !== Object.keys(targets).length) {
        throw new Error("Invalid Mihomo dependency manifest");
    }
    const remaining = new Map(manifest.targets.map(target => [target.output, target]));
    for (const name of Object.keys(targets)) {
        const spec = targetSpec(name, manifest.version);
        const entry = remaining.get(spec.output);
        if (!entry || entry.asset !== spec.asset || entry.source !== spec.source || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
            throw new Error(`Invalid Mihomo dependency lock for ${name}`);
        }
        remaining.delete(spec.output);
    }
    if (remaining.size) throw new Error("Duplicate Mihomo dependency targets");
    return manifest;
}

function sha256(file) {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function matches(file, digest) {
    let descriptor;
    try {
        descriptor = fs.openSync(file, "r");
        // Check and hash the same opened file, even if its path is replaced.
        return fs.fstatSync(descriptor).isFile() && sha256(descriptor) === digest;
    } catch (error) {
        if (["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)) return false;
        throw error;
    } finally {
        if (descriptor !== undefined) fs.closeSync(descriptor);
    }
}

function verifyBinary(file, spec) {
    const descriptor = fs.openSync(file, "r");
    const header = Buffer.alloc(64);
    try { fs.readSync(descriptor, header, 0, header.length, 0); }
    finally { fs.closeSync(descriptor); }
    if (spec.platform === "win32") {
        if (header.subarray(0, 2).toString() !== "MZ") throw new Error(`Invalid Mihomo executable for ${spec.name}`);
        const pe = Buffer.alloc(6);
        const fd = fs.openSync(file, "r");
        try { fs.readSync(fd, pe, 0, pe.length, header.readUInt32LE(60)); }
        finally { fs.closeSync(fd); }
        if (pe.readUInt32LE(0) !== 0x4550 || pe.readUInt16LE(4) !== (spec.arch === "x64" ? 0x8664 : 0xaa64)) {
            throw new Error(`Wrong Mihomo CPU architecture for ${spec.name}`);
        }
    } else if (spec.platform === "linux") {
        if (header.subarray(0, 4).toString("hex") !== "7f454c46" || header[4] !== 2 || header[5] !== 1
            || header.readUInt16LE(18) !== (spec.arch === "x64" ? 62 : 183)) {
            throw new Error(`Wrong Mihomo ELF architecture for ${spec.name}`);
        }
    } else if (header.readUInt32LE(0) !== 0xfeedfacf
        || header.readUInt32LE(4) !== (spec.arch === "x64" ? 0x01000007 : 0x0100000c)) {
        throw new Error(`Wrong Mihomo Mach-O architecture for ${spec.name}`);
    }
}

function serviceManifest(root, spec, digest) {
    const entries = [{ name: path.posix.basename(spec.legacy), sha256: sha256(path.join(root, "app", spec.legacy)).toUpperCase() },
        { name: path.posix.basename(spec.output), sha256: digest.toUpperCase() }];
    const result = { cores: entries };
    if (spec.platform === "darwin") {
        result.helpers = [{ name: "sysproxy", sha256: sha256(path.join(root, "app", path.posix.dirname(spec.output), "sysproxy")).toUpperCase() }];
    }
    return result;
}

function verifyServiceManifest(root, spec, digest) {
    const expected = serviceManifest(root, spec, digest);
    const actual = JSON.parse(fs.readFileSync(path.join(root, "app", spec.serviceManifest), "utf8"));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Service allow-list does not match the locked Mihomo and packaged assets for ${spec.name}; run mihomo:update explicitly`);
    }
}

function noticeText(version) {
    return `Mihomo core binary\n\nProject: MetaCubeX/mihomo\nVersion: ${version}\n`
        + `Release: https://github.com/MetaCubeX/mihomo/releases/tag/v${version}\n`
        + `Corresponding source: https://github.com/MetaCubeX/mihomo/tree/v${version}\n`
        + "License: GNU General Public License v3.0\n"
        + `License text: https://github.com/MetaCubeX/mihomo/blob/v${version}/LICENSE\n\n`
        + "The binary is redistributed unmodified from the official release. See\n"
        + "app/clash_core/mihomo-core-manifest.json in the source repository for the\n"
        + "asset URL and SHA-256 digest.\n";
}

// Stage complete siblings first; rollback earlier replacements if any later rename fails.
function replaceFiles(outputs, work) {
    const staged = [];
    try {
        for (const [file, value] of outputs) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            const temporary = `${file}.${crypto.randomUUID()}.tmp`;
            const backup = fs.existsSync(file) ? path.join(work, `backup-${staged.length}`) : null;
            if (backup) fs.copyFileSync(file, backup);
            const entry = { file, temporary, backup, replaced: false };
            staged.push(entry);
            if (value.source) {
                fs.copyFileSync(value.source, temporary);
                fs.chmodSync(temporary, 0o755);
            } else fs.writeFileSync(temporary, value.text, { flag: "wx" });
        }
        for (const entry of staged) {
            fs.renameSync(entry.temporary, entry.file);
            entry.replaced = true;
        }
    } catch (error) {
        for (const entry of staged.slice().reverse()) {
            if (!entry.replaced) continue;
            if (entry.backup) fs.copyFileSync(entry.backup, entry.file);
            else fs.unlinkSync(entry.file);
        }
        throw error;
    } finally {
        for (const entry of staged) fs.rmSync(entry.temporary, { force: true });
    }
}

async function withLock(root, action) {
    const directory = path.join(root, "app/build/dependencies");
    fs.mkdirSync(directory, { recursive: true });
    const lock = path.join(directory, "mihomo.lock");
    let fd;
    try { fd = fs.openSync(lock, "wx"); }
    catch (error) {
        if (error.code !== "EEXIST") throw error;
        throw new Error("Mihomo preparation is already running. Retry after it finishes; remove app/build/dependencies/mihomo.lock only if that process has stopped.");
    }
    let work;
    try {
        try { fs.writeFileSync(fd, `${process.pid}\n`); }
        finally { fs.closeSync(fd); }
        work = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-mihomo-"));
        return await action(work);
    }
    finally {
        try { if (work) fs.rmSync(work, { recursive: true, force: true }); }
        finally { fs.unlinkSync(lock); }
    }
}

async function prepareMihomo({ root = repositoryRoot, targetNames = Object.keys(targets),
    cacheRoot = process.env.CFW_MIHOMO_CACHE || path.join(root, "app/build/dependencies/mihomo"),
    offline = process.env.CFW_MIHOMO_OFFLINE === "1", download = downloadFile, extract = extractBinary,
    log = console.log } = {}) {
    return withLock(root, async work => {
        const manifest = readManifest(root);
        if (!targetNames.length || new Set(targetNames).size !== targetNames.length) throw new Error("Expected unique Mihomo targets");
        const selected = targetNames.map(name => {
            const spec = targetSpec(name, manifest.version);
            const entry = manifest.targets.find(item => item.output === spec.output);
            verifyServiceManifest(root, spec, entry.sha256);
            return { spec, entry };
        });
        const outputs = new Map();
        for (const { spec, entry } of selected) {
            const output = path.join(root, "app", spec.output);
            const cache = path.join(cacheRoot, entry.sha256, path.posix.basename(spec.output));
            if (matches(output, entry.sha256)) {
                verifyBinary(output, spec);
                if (spec.platform !== "win32") fs.chmodSync(output, 0o755);
                if (!matches(cache, entry.sha256)) outputs.set(cache, { source: output });
                continue;
            }
            let source = cache;
            if (!matches(cache, entry.sha256)) {
                if (offline) throw new Error(`Mihomo ${manifest.version} (${spec.name}) is missing from the verified local cache; prepare it online first`);
                log(`Downloading Mihomo ${manifest.version} for ${spec.name}...`);
                const archive = path.join(work, spec.asset);
                source = path.join(work, spec.name);
                await download(spec.source, archive);
                await extract(archive, source, spec);
                if (!matches(source, entry.sha256)) throw new Error(`Mihomo SHA-256 mismatch for ${spec.name}`);
                verifyBinary(source, spec);
                outputs.set(cache, { source });
            }
            verifyBinary(source, spec);
            outputs.set(output, { source });
        }
        replaceFiles(outputs, work);
        return manifest;
    });
}

async function updateMihomo(version, { root = repositoryRoot,
    cacheRoot = process.env.CFW_MIHOMO_CACHE || path.join(root, "app/build/dependencies/mihomo"),
    download = downloadFile, extract = extractBinary, log = console.log } = {}) {
    version = validateVersion(version);
    return withLock(root, async work => {
        const previous = readManifest(root);
        for (const name of Object.keys(targets)) {
            const spec = targetSpec(name, previous.version);
            // A Mihomo upgrade must not authorize changed legacy cores or system helpers.
            verifyServiceManifest(root, spec, previous.targets.find(item => item.output === spec.output).sha256);
        }
        const outputs = new Map();
        const manifest = { project: "MetaCubeX/mihomo", version,
            release: `https://github.com/MetaCubeX/mihomo/releases/tag/v${version}`, targets: [] };
        for (const name of Object.keys(targets)) {
            const spec = targetSpec(name, version);
            const archive = path.join(work, spec.asset);
            const source = path.join(work, name);
            log(`Resolving Mihomo ${version} for ${name}...`);
            await download(spec.source, archive);
            await extract(archive, source, spec);
            verifyBinary(source, spec);
            const digest = sha256(source);
            // Re-resolving an existing version must never silently replace its trusted hash.
            if (previous.version === version && previous.targets.find(item => item.output === spec.output).sha256 !== digest) {
                throw new Error(`Mihomo SHA-256 mismatch for already locked version ${version} (${name})`);
            }
            manifest.targets.push({ asset: spec.asset, output: spec.output, source: spec.source, sha256: digest });
            outputs.set(path.join(cacheRoot, digest, path.posix.basename(spec.output)), { source });
            outputs.set(path.join(root, "app", spec.output), { source });
            outputs.set(path.join(root, "app", spec.notice), { text: noticeText(version) });
            outputs.set(path.join(root, "app", spec.serviceManifest), {
                text: `${JSON.stringify(serviceManifest(root, spec, digest), null, 2)}\n`
            });
        }
        outputs.set(path.join(root, manifestRelative), { text: `${JSON.stringify(manifest, null, 2)}\n` });
        replaceFiles(outputs, work);
        return manifest;
    });
}

module.exports = { targets, targetSpec, readManifest, sha256, matches, verifyBinary, serviceManifest,
    verifyServiceManifest, prepareMihomo, updateMihomo };
