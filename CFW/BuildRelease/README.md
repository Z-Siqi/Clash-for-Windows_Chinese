# Build release packages

From the repository root:

```sh
npm run build:release
# Equivalent:
node CFW/BuildRelease/build-release.js
```

On Windows, `build-release.cmd` is also available. Install the repository's
dependencies first with the existing project setup procedure. Node 18+,
Inno Setup 6.3+ on Windows, and a `7z` CLI (7-Zip or NanaZip) for Windows/macOS
portable archives are required. Set `ISCC_PATH` or `CFW_7ZIP` for nonstandard
tool locations. No installer is executed by this build script.
On macOS use the current official 7-Zip CLI (`CFW_7ZIP=7zz` if applicable)
to preserve framework symlinks in portable archives.

The default builds every target that this host can finish:

| Host | Targets | Release files per architecture |
| --- | --- | --- |
| Windows | Windows x64/ARM64 and Linux x64/ARM64 | Windows `.exe` + `.7z`; Linux `.deb` + `.tar.gz` |
| macOS | macOS x64/ARM64 and Linux x64/ARM64 | macOS `.dmg` + `.7z`; Linux `.deb` + `.tar.gz` |
| Linux | Linux x64/ARM64 | `.deb` + `.tar.gz` |

Windows installers need a Windows host with Inno Setup. macOS DMGs/signing
need a macOS host with the existing `hdiutil`/`SetFile` prerequisites. Use the
same entry point on those hosts to complete the full six-target release.
Unsupported targets are explicitly reported, not advertised as built.
`--all` requires all six targets and fails preflight when the host cannot
finish them. A Windows machine cannot produce the macOS DMGs through the
current native packaging pipeline.

```sh
node CFW/BuildRelease/build-release.js --plan
node CFW/BuildRelease/build-release.js --targets=win-x64,win-arm64
node CFW/BuildRelease/build-release.js --targets=linux-x64,linux-arm64
node CFW/BuildRelease/build-release.js --targets=mac-x64,mac-arm64
```

Builds run the project's test gate by default, using the same Monaco,
renderer and test-group commands as `npm test`. `--skip-tests` is available
when the gate has already passed for the current source. Failures stop the
run and retain its logs and partial outputs; the most recent successful run
pointer is not replaced by a failed run.

The script reuses `scripts/build/package-application.js` and
`package-dmg.js`, which also implement the existing `app/build_*` wrappers.
`CFW_BUILD_ROOT` relocates their generated assets and packages for this run;
ordinary application builds retain their `app/build` default.

## Files

Everything created by the release pipeline stays under the ignored `Build`
directory (apart from synchronizing checked-in release metadata):

```text
Build/
  cache/electron/                  reusable Electron download cache
  legacy-inno/                    preserved old AppFiles and Output
  Output/<version>/<run-id>/       upload-ready packages, SHA256SUMS, update
  <version>/<run-id>/
    work/generated/               Monaco and renderer builds
    work/packages/<target>/        unpacked applications and packaging metadata
    staging/                      Linux package filesystem/control staging
    temp/                         build-tool temporary files
    logs/                         per-command logs
    manifest.json                 targets, omissions, status, sizes and hashes
  latest.json                     locations from the last successful run
```

The application version, display revision, Electron version and asset naming
are controlled by `app/main/dist/electron/core/release/release-config.json`
and its shared release functions. Windows installer names have a distinct
`.arm64.exe` suffix; the Inno script limits each installer to the matching OS
architecture. Portable archives retain their package directory at the root.

Publish packages from `Build/Output/<version>/<run-id>`, not the unpacked `work` directory. Its
`update` feed lists only files this run actually produced. Combine the
per-host artifacts and feed entries for a full release, upload the packages
to the correct tag, then publish the feed. The script does not upload or
publish anything.

## Linux installation

The `.deb` packages are for Debian/Ubuntu-family distributions, with `amd64`
and `arm64` architecture tags. They install the app under
`/opt/clash-for-windows`, a `/usr/bin/cfw` launcher, a desktop entry and icon.
The package and configure hook preserve the root-owned setuid Chromium
sandbox; no `--no-sandbox` workaround is used. They do not install or enable
Service Mode, change system proxies, or modify the user's CFW data directory.

```sh
sudo apt install ./Clash.for.Windows-<version>-linux-x64.deb
# Removal:
sudo apt remove clash-for-windows
```

The portable `.tar.gz` remains available for other distributions; its
included desktop installer configures the sandbox with `sudo` when needed.
RPM, AppImage, Snap and Flatpak are separate Linux distribution formats;
this pipeline currently produces Debian installers and portable tarballs.
The Debian writer is portable Node code, so it can build on Windows without
installing Linux packages into the developer's system. Validate release
files with `dpkg-deb --info` and `dpkg-deb --contents`, and verify actual
installation, GUI startup and TUN/Service Mode on matching Linux hosts.
