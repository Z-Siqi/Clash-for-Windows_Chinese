"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "../..");
// The helper is portable POSIX Go code; keep one audited implementation for
// Linux and macOS even though its historical source directory names Linux.
const sourceRoot = path.join(repositoryRoot, "scripts/native/linux-service-helper");
const goCache = path.join(repositoryRoot, "app/build/toolchains/go-cache");
const targets = [
    {
        goArch: "amd64",
        directory: path.join(repositoryRoot, "app/clash_core/darwin-x64/static/files/darwin/x64"),
        cores: ["clash-darwin", "mihomo-darwin-amd64"]
    },
    {
        goArch: "arm64",
        directory: path.join(repositoryRoot, "app/clash_core/darwin-arm64/static/files/darwin/arm64"),
        cores: ["clash-darwin", "mihomo-darwin-arm64"]
    }
];

function sha256(file) {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

for (const target of targets) {
    const serviceDirectory = path.join(target.directory, "service");
    const helper = path.join(serviceDirectory, "clash-core-service");
    fs.mkdirSync(serviceDirectory, { recursive: true });
    fs.mkdirSync(goCache, { recursive: true });
    const result = spawnSync("go", [
        "build", "-trimpath", "-buildvcs=false", "-ldflags=-s -w -buildid=", "-o", helper, "."
    ], {
        cwd: sourceRoot,
        env: {
            ...process.env,
            GOOS: "darwin",
            GOARCH: target.goArch,
            CGO_ENABLED: "0",
            GOCACHE: goCache
        },
        stdio: "inherit",
        windowsHide: true
    });
    if (result.status !== 0) throw new Error(`macOS service helper build failed for ${target.goArch}`);
    fs.chmodSync(helper, 0o755);
    const manifest = {
        cores: target.cores.map(name => ({ name, sha256: sha256(path.join(target.directory, name)) })),
        helpers: [{ name: "sysproxy", sha256: sha256(path.join(target.directory, "sysproxy")) }]
    };
    fs.writeFileSync(path.join(serviceDirectory, "core-hashes.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log("Built allow-listed macOS Service Mode helpers for amd64 and arm64");
