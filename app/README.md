# Application development and builds

`app/main` is the readable Electron application source. Generated files and packaged
applications are written below `app/build`; that directory is ignored by Git and must
not be committed.

## Requirements

- Node.js 18 or newer
- npm
- Windows PowerShell 3 or newer for the Windows wrapper scripts
- Bash for the native Linux/macOS default wrapper

Install both the repository build tools and the application runtime dependencies from
the repository root:

```powershell
npm ci
npm --prefix app/main ci
```

## Tests

All tests and fixtures live below `app/test`. The canonical gate remains:

```powershell
npm test
```

Focused gates are available while developing:

```powershell
npm run test:unit
npm run test:integration
npm run test:architecture
npm run test:application
```

The test commands rebuild the pinned Monaco assets in
`app/build/generated/monaco` before running.

## Packaging

Use one of the npm targets:

```powershell
npm run package:win-x64
npm run package:win-ia32
npm run package:win-arm64
npm run package:linux-x64
npm run package:linux-arm64
npm run package:mac-x64
npm run package:mac-arm64
```

The native default wrappers detect the host architecture and select the matching
package target automatically:

```powershell
# Windows: detects AMD64, x86, or ARM64. The window waits for a key before closing.
app\build_default.bat
```

```bash
# Linux/macOS: detects x86_64 or arm64. On Apple Silicon it also detects a shell
# running through Rosetta and selects the native arm64 package. It waits for a key
# before closing in a terminal.
bash app/build_default.sh
```

Unsupported operating systems and architectures stop with an explanatory error instead
of building a package for the wrong device. The explicit PowerShell wrappers in this
directory remain available when a particular target must be selected manually.

macOS packaging must run on a Mac. Before using either macOS target, add the audited
platform assets under `app/clash_core/darwin-x64/static` or
`app/clash_core/darwin-arm64/static`. Each target must contain `Country.mmdb` plus
the matching `clash-darwin`, Mihomo, `sysproxy`, and Service Mode helper binaries.
The packager validates those files and marks native executables as executable; an
incomplete target fails with an explicit list instead of producing a broken app.
Code signing, notarization, and DMG creation are separate release steps and are not
performed by this local packaging command.

Each invocation receives a unique output directory:

```text
app/build/packages/<target>/<UTC timestamp>-<process id>/
```

`app/build/packages/<target>/latest.json` points to the most recent successful output.
The build never deletes or overwrites an earlier package, so a previously built Windows
application may remain open while another build runs. Close running applications only
when you want to delete their old build directories manually.

The packaging pipeline performs these steps:

1. Build the locked Monaco browser runtime into `app/build/generated/monaco`.
2. Copy the readable application from `app/main` into Electron Packager's staging area.
3. Inject Monaco before ASAR creation.
4. Prune production dependencies and create the ASAR.
5. Copy renderer UI assets and the selected platform's Clash/Mihomo and service files into `resources/static`.

Build failures return a non-zero exit code and do not replace `latest.json`.
