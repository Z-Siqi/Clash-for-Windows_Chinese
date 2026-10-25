"use strict";

// The helper, manifest and executable cores must all have protected ancestors.
// Quoting every variable also protects installations under unusual user paths.
const quote = value => `'${String(value).replace(/'/g, `'"'"'`)}'`;
function posixServiceDirectory(platform) {
    return platform === "darwin" ? "/Library/PrivilegedHelperTools/com.lbyczf.cfw" : "/usr/lib/clash-for-windows-service";
}

function buildPosixServiceInstall({ platform, path, source, destination, credentialFile, manifest, serviceFile, serviceContent }) {
    const group = platform === "darwin" ? "wheel" : "root";
    const entries = [...manifest.cores, ...(manifest.helpers || [])];
    if (!entries.length || entries.some(entry => !/^[\w.-]+$/.test(entry.name) || entry.name === "." || entry.name === "..")) throw new Error("Invalid service manifest");
    const copies = entries.map(entry => `install -o root -g ${group} -m 755 ${quote(path.join(source, "..", entry.name))} ${quote(path.join(destination, "cores", entry.name))}`);
    return [
        "set -eu",
        // Refuse an existing redirected installation instead of writing through it.
        `test ! -L ${quote(destination)}`,
        `test ! -L ${quote(path.join(destination, "cores"))}`,
        `install -d -o root -g ${group} -m 755 ${quote(destination)} ${quote(path.join(destination, "cores"))}`,
        `install -o root -g ${group} -m 755 ${quote(path.join(source, "clash-core-service"))} ${quote(path.join(destination, "clash-core-service"))}`,
        `install -o root -g ${group} -m 644 ${quote(path.join(source, "core-hashes.json"))} ${quote(path.join(destination, "core-hashes.json"))}`,
        `install -o root -g ${group} -m 600 ${quote(credentialFile)} ${quote(path.join(destination, "service-config.json"))}`,
        ...copies,
        `printf '%s' ${quote(serviceContent)} > ${quote(serviceFile)}`,
        `chown root:${group} ${quote(serviceFile)}`,
        `chmod 644 ${quote(serviceFile)}`
    ].join("; ");
}

module.exports = { posixServiceDirectory, buildPosixServiceInstall };
