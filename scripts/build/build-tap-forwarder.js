"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { downloadFile } = require("./mihomo-download");

const root = path.resolve(__dirname, "../..");
const overlay = path.join(root, "scripts/native/tap-forwarder");
const pin = require(path.join(overlay, "upstream.json"));
const buildRoot = path.join(root, "app/build/tap-forwarder");
const go = process.env.CFW_GO_PATH || "go";
const compilerBin = process.env.CFW_MINGW_BIN;
const hash = value => crypto.createHash("sha256").update(value).digest("hex");

function run(command, args, options = {}) {
    const result = spawnSync(command, args, { windowsHide: true, stdio: "inherit", ...options });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status})`);
    return result;
}

function replaceOnce(file, before, after) {
    const source = fs.readFileSync(file, "utf8");
    if (source.split(before).length !== 2) throw new Error(`Unexpected upstream source in ${file}`);
    fs.writeFileSync(file, source.replace(before, after));
}

async function installBinary(source, destination) {
    // Windows may briefly hold a just-executed PE image open after it exits.
    for (let attempt = 0; ; attempt++) {
        try { fs.copyFileSync(source, destination); return; }
        catch (error) {
            if (attempt >= 10 || !["EBUSY", "EPERM", "UNKNOWN"].includes(error.code)) throw error;
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}

async function prepareSourceArchive(directory, metadata = pin, download = downloadFile) {
    // Each build owns a fresh directory; the downloader creates the archive
    // exclusively, with a bounded HTTPS transfer. Never overwrite a shared cache.
    const archive = path.join(directory, "upstream.tar.gz");
    await download(metadata.archive, archive, { maximum: 8 * 1024 * 1024 });
    const descriptor = fs.openSync(archive, "r");
    try {
        if (!fs.fstatSync(descriptor).isFile() || hash(fs.readFileSync(descriptor)) !== metadata.sha256) {
            throw new Error("TAP upstream archive integrity check failed");
        }
    } finally { fs.closeSync(descriptor); }
    return archive;
}

async function main() {
    if (!compilerBin) throw new Error("Set CFW_MINGW_BIN to the LLVM-MinGW bin directory");
    const version = spawnSync(go, ["version"], { encoding: "utf8", windowsHide: true });
    if (version.status !== 0 || !version.stdout.includes(` ${pin.goVersion} `)) throw new Error(`Use pinned ${pin.goVersion} via CFW_GO_PATH`);
    fs.mkdirSync(buildRoot, { recursive: true });
    const build = fs.mkdtempSync(path.join(buildRoot, "build-"));
    const archive = await prepareSourceArchive(build);
    run("tar", ["-xzf", archive, "-C", build]);
    const source = path.join(build, `go-tun2socks-${pin.commit}`);
    for (const file of ["multicast_policy.go", "multicast_policy_test.go"]) fs.copyFileSync(path.join(overlay, file), path.join(source, "tun", file));
    fs.copyFileSync(path.join(overlay, "packet_policy_cli.go"), path.join(source, "cmd/tun2socks/packet_policy_cli.go"));
    replaceOnce(path.join(source, "cmd/tun2socks/main.go"), "\tflag.Parse()", "\tflag.Parse()\n\tif configurePacketPolicy() { return }");
    replaceOnce(path.join(source, "tun/tun_windows.go"), "} else if dev.rBuf[14]&0xf0 == 0x40 {", "} else if dev.rBuf[14]&0xf0 == 0x40 {\n\t\t\t\tif FilterIPv4Multicast(dev.rBuf[14:nr], AllowMulticast) { continue }");
    const baseEnv = { ...process.env, GOCACHE: path.join(root, "app/build/toolchains/go-cache"), CGO_ENABLED: "0" };
    // Run the portable packet policy without importing Windows TAP or lwIP/cgo.
    run(go, ["test", path.join(source, "tun/multicast_policy.go"), path.join(source, "tun/multicast_policy_test.go")], { cwd: source, env: baseEnv });
    const targets = [
        { arch: "amd64", cc: "x86_64", file: "app/clash_core/win_x64/static/files/win/x64/go-tun2socks.exe" },
        // The legacy ARM64 payload contains an x86 helper; keep its emulation
        // architecture. The packaged TAP kernel driver is still unsupported there.
        { arch: "386", cc: "i686", file: "app/clash_core/win32-arm64/static/files/win/arm64/go-tun2socks.exe" }
    ];
    for (const target of targets) {
        const output = path.join(build, `go-tun2socks-${target.arch}.exe`);
        run(go, ["build", "-trimpath", "-buildvcs=false", "-tags", "socks", `-ldflags=-s -w -buildid= -X main.version=${pin.version} -extldflags=-static`, "-o", output, "./cmd/tun2socks"], {
            cwd: source, env: { ...baseEnv, GOOS: "windows", GOARCH: target.arch, CGO_ENABLED: "1", CGO_CFLAGS: "-O2 -g -Wno-pragma-pack", CC: path.join(compilerBin, `${target.cc}-w64-mingw32-clang${process.platform === "win32" ? ".exe" : ""}`) }
        });
        target.sha256 = hash(fs.readFileSync(output));
        target.output = output;
    }
    // Do not install either target until both builds succeed.
    for (const target of targets) await installBinary(target.output, path.join(root, target.file));
    const sourceFiles = ["scripts/build/build-tap-forwarder.js", ...["upstream.json", "multicast_policy.go", "multicast_policy_test.go", "packet_policy_cli.go"].map(file => `scripts/native/tap-forwarder/${file}`)];
    const manifest = { version: pin.version, upstreamCommit: pin.commit,
        sources: Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n"))])),
        targets: targets.map(({ arch, file, sha256 }) => ({ arch, file, sha256 })) };
    fs.writeFileSync(path.join(root, "app/clash_core/tap-forwarder-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    const env = name => spawnSync(go, ["env", name], { encoding: "utf8", windowsHide: true }).stdout.trim();
    const lwipLicense = fs.readFileSync(path.join(source, "core/c/core/init.c"), "utf8").match(/\/\*\s*\n \* Copyright[\s\S]*?\*\//)?.[0];
    if (!lwipLicense) throw new Error("Missing lwIP license notice");
    const licenses = [
        fs.readFileSync(path.join(source, "LICENSE"), "utf8"), lwipLicense,
        fs.readFileSync(path.join(env("GOROOT"), "LICENSE"), "utf8"),
        ...["net@v0.0.0-20191021144547-ec77196f6094", "sys@v0.0.0-20191026070338-33540a1f6037"].map(module => fs.readFileSync(path.join(env("GOMODCACHE"), "golang.org/x", module, "LICENSE"), "utf8"))
    ];
    const notice = `go-tun2socks ${pin.version}\nUpstream: ${pin.repository}/tree/${pin.commit}\nCFW source changes: scripts/native/tap-forwarder and scripts/build/build-tap-forwarder.js\nIncludes lwIP, Go, golang.org/x/net and golang.org/x/sys.\n\n${licenses.join("\n\n")}`;
    for (const platform of ["win_x64", "win32-arm64"]) fs.writeFileSync(path.join(root, "app/clash_core", platform, "static/files/TAP_FORWARDER_NOTICE.txt"), notice);
    console.log(`Built ${pin.version} for Windows amd64 and x86`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { prepareSourceArchive };
