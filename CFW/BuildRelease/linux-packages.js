"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { createGzip } = require("node:zlib");

function tarHeader(name, stat, mode, link = "") {
    const header = Buffer.alloc(512);
    let prefix = "";
    if (Buffer.byteLength(name) > 100) {
        const positions = [...name.matchAll(/\//g)].map(match => match.index).reverse();
        const split = positions.find(index => Buffer.byteLength(name.slice(index + 1)) <= 100 && Buffer.byteLength(name.slice(0, index)) <= 155);
        if (split === undefined) throw new Error(`Archive path is too long: ${name}`);
        prefix = name.slice(0, split); name = name.slice(split + 1);
    }
    if (Buffer.byteLength(link) > 100) throw new Error("Archive symlink is too long");
    const text = (value, offset, length) => header.write(String(value), offset, length, "utf8");
    const octal = (value, offset, length) => text(value.toString(8).padStart(length - 1, "0") + "\0", offset, length);
    text(name, 0, 100); octal(mode, 100, 8); octal(0, 108, 8); octal(0, 116, 8);
    octal(stat.isFile() ? stat.size : 0, 124, 12); octal(Math.floor(stat.mtimeMs / 1000), 136, 12);
    header.fill(32, 148, 156);
    text(stat.isDirectory() ? "5" : stat.isSymbolicLink() ? "2" : "0", 156, 1);
    text(link, 157, 100); text("ustar\0", 257, 6); text("00", 263, 2);
    text("root", 265, 32); text("root", 297, 32); text(prefix, 345, 155);
    text(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, "0") + "\0 ", 148, 8);
    return header;
}

function fileMode(file, relative, installed) {
    if (installed && relative.endsWith("/chrome-sandbox")) return 0o4755;
    if (/\.(?:sh)$/.test(relative) || relative === "usr/bin/cfw") return 0o755;
    const descriptor = fs.openSync(file, "r");
    const signature = Buffer.alloc(4);
    try { fs.readSync(descriptor, signature, 0, 4, 0); } finally { fs.closeSync(descriptor); }
    return signature.equals(Buffer.from([0x7f, 69, 76, 70])) ? 0o755 : 0o644;
}

async function createTarGz(directory, output, { prefix = "", installed = false, executable = [] } = {}) {
    async function* walk(folder, relative = "") {
        for (const entry of fs.readdirSync(folder).sort()) {
            const file = path.join(folder, entry);
            const relativeName = relative ? `${relative}/${entry}` : entry;
            const name = prefix ? `${prefix}/${relativeName}` : relativeName;
            const stat = fs.lstatSync(file);
            if (!stat.isFile() && !stat.isDirectory() && !stat.isSymbolicLink()) throw new Error("Unsupported archive entry");
            const link = stat.isSymbolicLink() ? fs.readlinkSync(file).replace(/\\/g, "/") : "";
            const mode = stat.isDirectory() || stat.isSymbolicLink() || executable.includes(relativeName) ? 0o755 : fileMode(file, relativeName, installed);
            yield tarHeader(name, stat, mode, link);
            if (stat.isFile()) {
                yield* fs.createReadStream(file);
                const padding = (512 - stat.size % 512) % 512;
                if (padding) yield Buffer.alloc(padding);
            } else if (stat.isDirectory()) yield* walk(file, relativeName);
        }
    }
    async function* contents() { yield* walk(directory); yield Buffer.alloc(1024); }
    await pipeline(Readable.from(contents()), createGzip({ level: 6 }), fs.createWriteStream(output, { flags: "wx" }));
}

async function createDeb({ packagePath, target, version, output, staging, applicationId }) {
    const arch = target === "linux-x64" ? "amd64" : target === "linux-arm64" ? "arm64" : null;
    if (!arch || !/^\d+\.\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid Debian package target/version");
    const control = path.join(staging, "control");
    const data = path.join(staging, "data");
    const installed = path.join(data, "opt/clash-for-windows");
    fs.mkdirSync(control, { recursive: true });
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.cpSync(packagePath, installed, { recursive: true });
    fs.mkdirSync(path.join(data, "usr/bin"), { recursive: true });
    fs.mkdirSync(path.join(data, "usr/share/applications"), { recursive: true });
    fs.mkdirSync(path.join(data, "usr/share/icons/hicolor/512x512/apps"), { recursive: true });
    fs.writeFileSync(path.join(data, "usr/bin/cfw"), '#!/bin/sh\nset -eu\ncd /opt/clash-for-windows\nexec ./cfw "$@"\n');
    fs.writeFileSync(path.join(data, `usr/share/applications/${applicationId}.desktop`), `[Desktop Entry]\nType=Application\nName=Clash for Windows\nExec=/usr/bin/cfw\nIcon=${applicationId}\nStartupWMClass=${applicationId}\nCategories=Network;\nTerminal=false\n`);
    fs.copyFileSync(path.join(packagePath, "resources/static/imgs/icon_512.png"), path.join(data, `usr/share/icons/hicolor/512x512/apps/${applicationId}.png`));
    fs.writeFileSync(path.join(control, "control"), `Package: clash-for-windows\nVersion: ${version}\nArchitecture: ${arch}\nMaintainer: CFW Chinese maintainers\nSection: net\nPriority: optional\nDepends: libc6, libgtk-3-0 | libgtk-3-0t64, libnss3, libgbm1, libasound2 | libasound2t64, libxss1, libatk-bridge2.0-0 | libatk-bridge2.0-0t64, libdrm2, libx11-xcb1\nDescription: Clash for Windows Chinese desktop proxy client\n Includes the legacy Clash and optional Mihomo cores.\n`);
    // dpkg applies root ownership and setuid mode from data.tar; retain Chromium's sandbox.
    fs.writeFileSync(path.join(control, "postinst"), '#!/bin/sh\nset -eu\nif [ "$1" = configure ]; then\n  sandbox=/opt/clash-for-windows/chrome-sandbox\n  [ -f "$sandbox" ] && [ ! -L "$sandbox" ]\n  chown root:root "$sandbox"\n  chmod 4755 "$sandbox"\n  if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database -q || true; fi\nfi\n');
    const controlTar = path.join(staging, "control.tar.gz"), dataTar = path.join(staging, "data.tar.gz");
    await createTarGz(control, controlTar, { executable: ["postinst"] });
    await createTarGz(data, dataTar, { installed: true });
    async function* members() {
        yield Buffer.from("!<arch>\n");
        for (const [name, file] of [["debian-binary", null], ["control.tar.gz", controlTar], ["data.tar.gz", dataTar]]) {
            const size = file ? fs.statSync(file).size : 4;
            yield Buffer.from(`${(name + "/").padEnd(16)}${"0".padEnd(12)}${"0".padEnd(6)}${"0".padEnd(6)}${"100644".padEnd(8)}${String(size).padEnd(10)}\x60\n`);
            if (file) yield* fs.createReadStream(file); else yield Buffer.from("2.0\n");
            if (size % 2) yield Buffer.from("\n");
        }
    }
    await pipeline(Readable.from(members()), fs.createWriteStream(output, { flags: "wx" }));
    return output;
}

module.exports = { tarHeader, createTarGz, createDeb };
