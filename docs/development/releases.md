# Release configuration and update delivery

`app/main/dist/electron/core/release/release-config.json` is the editable source
for the application version, Electron version, display revision, repository,
update branch, application identity, default subscription User-Agent and
published platform targets. `version` is a four-component numeric version
used for package metadata, release tags and update comparison. `displayVersion`
is an independent label (for example `Opt-4.test`) used in the UI, update dialogs
and every published package filename. Changing only the label does not make a
newer release; increase `version` to trigger update detection. Dependency
versions and the historical upstream version mentioned in credits are
independent of this release version.

## Preparing a release

Mihomo is prepared automatically from its pinned dependency manifest during tests
and platform packaging. To change its version, run `npm run mihomo:update --
<exact-version>` and review the lockfile, notices and service allow-lists before
running the release checks. See [native dependencies](native-dependencies.md).

1. Increase `version` in the release configuration, and set `displayVersion`
   independently. For example, `version: "0.2039.4.1"` and
   `displayVersion: "Opt-4.1"`. Labels use letters, digits, dots, underscores
   and hyphens (up to 64 characters) so package filenames stay valid.
   Change `electronVersion` only
   when upgrading Electron. Add a `publishedTargets` entry only when its asset
   will actually be published; supported build targets and published assets are
   different sets.
2. Run `npm run release:sync`. This updates the Electron package manifest and
   root package-lock metadata, the `update` feed, and the Inno Setup include
   `CFW/BuildRelease/InnoSetup/release.generated.iss`. These are generated compatibility
   files; do not edit their version fields independently. Existing feed release
   notes are preserved and can be edited in `update`.
3. Run `npm test` and `npm run release:check`. Renderer builds and platform
   packaging automatically synchronize metadata; the check command only reads.
4. Run `npm run build:release` for all targets supported by the current host,
   or select targets with `--targets`. Windows Inno Setup includes the generated
   definitions and architecture-specific paths from the runner. DMG and portable
   names use the same `assetName()` function as the update feed; Debian names
   use `debianAssetName()` from the same release module. See the
   [release runner guide](../../CFW/BuildRelease/README.md) for host requirements
   and output layout.
5. Publish the assets under the configured version tag before publishing the
   generated `update` file. The release runner creates Windows installers,
   portable archives and Linux Debian packages; it does not upload releases.

Runtime code reads the configuration directly. Packaging takes its Electron
version, application version and bundle identity from it. The Electron package
manifest must still contain a version because Electron and npm require one;
the synchronization check catches drift rather than maintaining a second
editable version. Subscription downloads take their default User-Agent from
`subscriptionUserAgent`. Per-profile headers override it; global headers override profile
headers, including case-insensitive User-Agent names.

## Package filenames and version metadata

All download filenames use `displayVersion`, with platform and architecture
suffixes identifying the package type:

| Target | Installer or disk image | Portable archive |
| --- | --- | --- |
| Windows x64 | `Clash.for.Windows.Setup_<displayVersion>.exe` | `Clash.for.Windows-<displayVersion>-win.7z` |
| Windows ARM64 | `Clash.for.Windows.Setup_<displayVersion>.arm64.exe` | `Clash.for.Windows-<displayVersion>-arm64-win.7z` |
| macOS x64 | `Clash.for.Windows-<displayVersion>.dmg` | `Clash.for.Windows-<displayVersion>-mac.7z` |
| macOS ARM64 | `Clash.for.Windows-<displayVersion>-arm64.dmg` | `Clash.for.Windows-<displayVersion>-arm64-mac.7z` |
| Linux x64 | `Clash.for.Windows-<displayVersion>-linux-x64.deb` | `Clash.for.Windows-<displayVersion>-x64-linux.tar.gz` |
| Linux ARM64 | `Clash.for.Windows-<displayVersion>-linux-arm64.deb` | `Clash.for.Windows-<displayVersion>-arm64-linux.tar.gz` |

For a display label of `Opt-4.test`, the Windows x64 portable archive is
`Clash.for.Windows-Opt-4.test-win.7z` and the Linux x64 Debian package is
`Clash.for.Windows-Opt-4.test-linux-x64.deb`.

The numeric `version` remains in Electron/npm metadata, Inno Setup's internal
application version, the Debian control file and the GitHub release tag. Build
directories are grouped by that numeric version and a unique run ID; the build
manifest records both versions. The generated feed uses the numeric `tag_name`
for comparison and URLs, and `display_version` for the visible label. Update
selection also accepts the numeric filenames from older releases.

## Current update path

Home checks the fixed raw GitHub `update` feed on startup and every six hours
when update checks are enabled. `register-public-content-ipc.js` fetches it in
the main process with a bounded Axios request. `checkForUpdate()` compares
numeric version components and selects an asset for the running platform,
architecture and portable mode.
The feed's `display_version` supplies the remote display label, independently
of `tag_name`; older feeds without it retain their historical naming rules.
Only asset URLs belonging to the configured
repository and advertised version are selected. The General page's download
action opens the release page. It does not currently install an update.

`features/application/update-runtime.js` and the `start-download` IPC remain
in the tree, but there is no production call to `createUpdateRuntime`.
Saved `silentUpdate` and `isSilentUpgraded` values are retained for compatibility;
the inactive automatic-update control is hidden. URL restrictions on the dormant
download IPC remain in force.

## Update capability boundaries

Update detection and installation are separate capabilities. The supported
application flow checks the feed and opens the release page; users install or
extract the downloaded package with the procedure for their operating system.
A successful feed check or completed download does not confirm installation.
The shared CFW data directory and Service Mode allow-lists remain part of the
installation contract.

The dormant download/install helper is compatibility code, not an automatic
update service. It accepts executable and DMG downloads, but has no supported
portable or Linux replacement path. Its event channel does not identify
concurrent update operations, and interruption, cancellation and retry do not
have a complete lifecycle contract. Its presence does not establish rollback,
signature verification or a confirmed application replacement.

The release runner emits `SHA256SUMS` and records artifact sizes and hashes in
its build manifest. The current update feed advertises names and URLs without
a signed installation manifest, and the application does not perform automatic
package verification or installation. Matching the configured repository and
release tag constrains asset selection; it is not a package signature check.

Feed retrieval requires access to the configured raw GitHub endpoint. Retrieval
failures are reported separately from a successful check that finds no newer
version. Feed requests and dormant Electron-session downloads use different
transports; there is no shared update-routing policy. Only targets with actual
published assets belong in `publishedTargets` and the published feed.
