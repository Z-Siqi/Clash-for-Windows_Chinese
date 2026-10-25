# Windows installers

Use `../build-release.js` or `../build-release.cmd`. Inno Setup 6.3 or newer is
required; set `ISCC_PATH` if its compiler is not in a standard installation
directory. The release runner selects the x64/ARM64 application, verifies its
PE architecture and passes `BuildSource`, `BuildOutput` and `TargetArch` to
this script. Outputs go into `../Build`, rather than this source directory.

`release.generated.iss` comes from `npm run release:sync`; edit the central
release configuration instead. Installer source files and existing output
from the former `CFW/InnoSetup` location were preserved in
`../Build/legacy-inno` during migration.
