"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { writeLinuxDesktopInstaller } = require("../../../scripts/build/package-application");

test("Linux portable launcher installs and removes only its own desktop integration", t => {
    const windows = process.platform === "win32";
    if (windows && spawnSync("wsl.exe", ["-d", "Ubuntu", "--exec", "true"], { windowsHide: true }).status !== 0) {
        t.skip("POSIX shell integration needs Linux/macOS or Ubuntu WSL on Windows"); return;
    }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-desktop-test-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const app = path.join(root, "portable app"), home = path.join(root, "home"), tools = path.join(root, "tools");
    for (const folder of [app, home, tools]) fs.mkdirSync(folder, { recursive: true });
    fs.mkdirSync(path.join(app, "resources/static/imgs"), { recursive: true });
    fs.writeFileSync(path.join(app, "resources/static/imgs/icon_512.png"), "fixture");
    fs.writeFileSync(path.join(app, "cfw"), "#!/bin/sh\nexit 0\n");
    fs.writeFileSync(path.join(app, "chrome-sandbox"), "fixture");
    fs.writeFileSync(path.join(home, "profile.yaml"), "preserve user profile");
    // Fake ownership checks; tests must never chown or chmod a real sandbox.
    fs.writeFileSync(path.join(tools, "stat"), '#!/bin/sh\ncase "$2" in\n%u) echo 0;;\n%a) echo 4755;;\n%u:%g:%a) echo 0:0:4755;;\nesac\n', { mode: 0o755 });
    fs.writeFileSync(path.join(tools, "id"), '#!/bin/sh\necho "${CFW_TEST_UID:-1000}"\n', { mode: 0o755 });
    for (const name of ["update-desktop-database", "gtk-update-icon-cache"]) {
        fs.writeFileSync(path.join(tools, name), '#!/bin/sh\nprintf "%s\\n" "$0 $*" >> "$HOME/cache-calls"\n', { mode: 0o755 });
    }
    writeLinuxDesktopInstaller(app, { platform: "linux", desktopId: "com.lbyczf.clashwin", productName: "cfw" });
    const posix = file => {
        if (!windows) return file;
        const result = spawnSync("wsl.exe", ["-d", "Ubuntu", "--exec", "wslpath", "-u", file], { encoding: "utf8", windowsHide: true });
        assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
    };
    const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
    const driver = path.join(root, "driver.sh");
    fs.writeFileSync(driver, `#!/bin/sh
set -eu
export HOME=${quote(posix(home))}
export XDG_DATA_HOME="$HOME/data"
export PATH=${quote(posix(tools))}:"$PATH"
chmod 755 ${quote(posix(tools))}/*
exec sh "$1"
`);
    const driverPath = posix(driver), appPath = posix(app);
    const run = name => {
        const args = windows ? ["-d", "Ubuntu", "--exec", "sh", driverPath, `${appPath}/${name}`] : [driverPath, `${appPath}/${name}`];
        return spawnSync(windows ? "wsl.exe" : "sh", args, { encoding: "utf8", windowsHide: true });
    };
    const installed = run("install-desktop-entry.sh");
    assert.equal(installed.status, 0, installed.stderr);
    const desktop = path.join(home, "data/applications/com.lbyczf.clashwin.desktop");
    const icon = path.join(home, "data/icons/hicolor/512x512/apps/com.lbyczf.clashwin.png");
    assert.match(fs.readFileSync(desktop, "utf8"), /TryExec=.*portable app\/launch-cfw.sh/);
    assert.match(fs.readFileSync(desktop, "utf8"), /Icon=.*\/data\/icons\/hicolor\/512x512\/apps\/com\.lbyczf\.clashwin\.png/);
    assert.ok(fs.existsSync(icon));
    fs.writeFileSync(path.join(tools, "chmod"), '#!/bin/sh\ncase "$2" in\n*/cfw|*/launch-cfw.sh) echo "Cannot chmod admin-owned app" >&2; exit 1;;\nesac\nexec /bin/chmod "$@"\n', { mode: 0o755 });
    assert.equal(run("install-desktop-entry.sh").status, 0); // Already executable admin-owned app.
    assert.equal(run("uninstall-desktop-entry.sh").status, 0);
    assert.equal(fs.existsSync(desktop), false); assert.equal(fs.existsSync(icon), false);
    assert.equal(run("uninstall-desktop-entry.sh").status, 0); // Idempotent.
    assert.equal(fs.readFileSync(path.join(home, "profile.yaml"), "utf8"), "preserve user profile");
    assert.ok(fs.existsSync(path.join(app, "cfw")));
    assert.match(fs.readFileSync(path.join(home, "cache-calls"), "utf8"), /gtk-update-icon-cache/);
    assert.equal(run("install-desktop-entry.sh").status, 0);
    const other = "[Desktop Entry]\nTryExec=/different/launch-cfw.sh\n";
    fs.writeFileSync(desktop, other);
    assert.equal(run("uninstall-desktop-entry.sh").status, 1);
    assert.equal(fs.readFileSync(desktop, "utf8"), other); assert.ok(fs.existsSync(icon));
    // Model sudo invocation without invoking sudo or touching any actual user.
    fs.writeFileSync(path.join(tools, "sudo"), '#!/bin/sh\nprintf "%s\\n" "$*" > "$HOME/sudo-forward"\n', { mode: 0o755 });
    fs.writeFileSync(path.join(tools, "chown"), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const rootDriver = fs.readFileSync(driver, "utf8").replace('exec sh "$1"', 'export CFW_TEST_UID=0 SUDO_UID=1000 SUDO_USER=desktop-fixture\nexec sh "$1"');
    fs.writeFileSync(driver, rootDriver);
    assert.equal(run("install-desktop-entry.sh").status, 0);
    assert.match(fs.readFileSync(path.join(home, "sudo-forward"), "utf8"), /-H -u desktop-fixture -- env -u XDG_DATA_HOME sh/);
    assert.equal(fs.readFileSync(desktop, "utf8"), other);
    assert.equal(run("uninstall-desktop-entry.sh").status, 0);
});
