# macOS packaging

## Outputs and architectures

Build Intel and Apple Silicon separately. The application, legacy Clash core,
Mihomo core, system-proxy helper, and Service Mode helper in one package must
all match the selected architecture.

The extracted legacy core can run on older systems, but the complete current
application uses Electron 44.4.4 and therefore requires macOS 13 or later. Do
not advertise the old package's former macOS 10.13 minimum for this build.

```sh
npm run package:mac-x64
npm run package:mac-arm64
```

These commands create `.app` bundles below `app/build/packages/<target>/` and
record the newest bundle in `latest.json`. They must run on macOS. The default
`app/build_default.sh` wrapper detects Intel, Apple Silicon, and Rosetta and
selects the native target.

Create a compressed UDIF disk image with an HFS+ filesystem and the standard
`Applications` symlink:

```sh
npm run package:dmg:mac-x64
npm run package:dmg:mac-arm64
```

The DMG command packages the app first, creates a uniquely named build
directory, and writes `latest-dmg.json`. It does not overwrite an older build.
HFS+ is used for compatibility with older supported macOS releases; UDZO is the
read-only compressed format suitable for downloads. A DMG is a distribution
container, not an installer package: users drag the app to Applications. The
application bundle and mounted volume both use `app/icon.icns`; keep that ICNS
resource complete instead of substituting a single-resolution PNG. The builder
first creates a writable UDRW image so Finder's custom-volume-icon attribute can
be stored on the volume, then converts that image to the final UDZO artifact.

The repository ships prebuilt Service Mode helpers. Rebuilding them after a
helper-source change requires Go 1.22 or later and `npm run
build:mac-service-helper`. Ordinary app and DMG packaging does not require Go.
The generated `core-hashes.json` allow-lists both cores and the packaged
`sysproxy` binary. The service exposes a dedicated, argument-restricted system
proxy endpoint; it must never regain the legacy arbitrary-command endpoint.
After upgrading an existing installation, use General → Service Mode → Manage
→ Update once so the installed helper and manifest receive this endpoint.

## Local builds and public releases

An unsigned DMG is sufficient only for local development. Public direct
distribution should use a Developer ID Application certificate, Hardened
Runtime, a secure timestamp, Apple notarization, and a stapled ticket. Apple
documents these requirements in [Notarizing macOS software before
distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
and [Creating distribution-signed code for
macOS](https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac/).

Set `CFW_CODESIGN_IDENTITY` to let Electron Packager sign the nested Electron
bundle and packaged Mach-O helpers in the correct order. The DMG command also
signs the completed disk image with the same identity:

```sh
export CFW_CODESIGN_IDENTITY='Developer ID Application: Example Name (TEAMID)'
npm run package:dmg:mac-arm64
```

Do not use `codesign --deep` as a shortcut for signing. Apple advises signing
nested code individually; Electron Packager delegates this to
`@electron/osx-sign`.

Store notarization credentials in the login keychain rather than source files
or environment logs. The profile setup is a one-time operation:

```sh
xcrun notarytool store-credentials CFW_NOTARY \
  --apple-id 'developer@example.com' \
  --team-id TEAMID \
  --password 'app-specific-password'
```

Submit the final DMG, wait for acceptance, and staple the ticket:

```sh
xcrun notarytool submit '/absolute/path/to/Clash.for.Windows-VERSION-arm64.dmg' \
  --keychain-profile CFW_NOTARY --wait
xcrun stapler staple '/absolute/path/to/Clash.for.Windows-VERSION-arm64.dmg'
```

## Release verification

Run these checks against each architecture before publishing:

```sh
codesign --verify --deep --strict --verbose=2 '/path/to/Clash for Windows.app'
spctl --assess --type execute --verbose=4 '/path/to/Clash for Windows.app'
xcrun stapler validate '/path/to/Clash.for.Windows-VERSION.dmg'
hdiutil verify '/path/to/Clash.for.Windows-VERSION.dmg'
```

Mount each DMG on a clean machine, drag the app into Applications, and verify
both local mode and Service Mode with both core selections. Do not test against
a developer profile or existing Service Mode installation. Intel packages can
be exercised on Apple Silicon through Rosetta, but release acceptance still
needs a real Intel macOS run when that architecture is advertised.
