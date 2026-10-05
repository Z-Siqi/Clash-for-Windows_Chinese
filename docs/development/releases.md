# Release configuration and update delivery

`app/main/dist/electron/core/release/release-config.json` is the editable source
for the application version, Electron version, display revision, repository,
update branch, application identity, default subscription User-Agent and
published platform targets. `version` is a four-component numeric version
used for packaging, release tags and update comparison. `displayVersion` is
an independent label (for example `Opt-4.1`) used in the UI, update dialogs
and Windows installer names. Changing only the label does not make a newer
release; increase `version` to trigger update detection. Dependency versions and the historical upstream
version mentioned in credits are independent of this release version.

## Preparing a release

1. Increase `version` in the release configuration, and set `displayVersion`
   independently. For example, `version: "0.2039.4.1"` and
   `displayVersion: "Opt-4.1"`. Labels use letters, digits, dots, underscores
   and hyphens (up to 64 characters) so installer filenames stay valid.
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
   names use the same `assetName()` function as the update feed. See
   `CFW/BuildRelease/README.md` for host requirements and output layout.
5. Publish the assets under the configured version tag before publishing the
   generated `update` file. The release runner creates Windows installers,
   portable archives and Linux Debian packages; it does not upload releases.

Runtime code reads the configuration directly. Packaging takes its Electron
version, application version and bundle identity from it. The Electron package
manifest must still contain a version because Electron and npm require one;
the synchronization check catches drift rather than maintaining a second
editable version. Subscription downloads use `ClashforWindows/Optimize` by
default. Per-profile headers override it; global headers override profile
headers, including case-insensitive User-Agent names.

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
The Settings `silentUpdate` switch and `isSilentUpgraded` state are remnants;
they do not establish an automatic updater. URL restrictions on the dormant
download IPC remain in force.

## Diagnosed failure points and recovery strategy

The following findings come from the current code and repository history, not
from running an installer on a developer machine.

| Finding | Evidence and consequence | Strategy |
| --- | --- | --- |
| Published installer was not recognized | The feed advertises `Clash.for.Windows.Setup_Opt-4.exe`; the old Home regex required a numeric application version in the filename. | Fixed by sharing asset naming and recognizing the published name, with tests for both architectures and legacy names. |
| Version sources drifted | Manifest/lock, renderer display, Inno version/name and update tag were independently edited. Inno reported only `4` while Electron reported four components. | Fixed by the release configuration and synchronization gate. |
| Four-component and decorated tags | The old comparison folded components into a base-1000 number; `v`/`Opt` tags could yield NaN, and large components could collide. | Fixed by validated component comparison and historical `v`/`-Opt.N` support. |
| Automatic installation was removed | Commit `d532c2f` removed the General page update/install action and replaced it with opening the release page. Current code has no runtime factory caller or `silentUpdate` consumer. | Restore a complete main-process update service if automatic installation is required; wiring a switch to the old helper alone is insufficient. |
| Completion listener race | In the helper at `12e50d8`, `start-download` was awaited before attaching `download` listeners. A fast completion could leave the promise pending. | Current helper registers first and handles completion before the IPC target reply. Preserve this regression test in a replacement updater. |
| Wrong Windows silent flags | Historical General workflow used `/S`; this repository ships an Inno Setup script. Inno documents `/SILENT` and `/VERYSILENT`, not `/S`. | Use an Inno-specific argument list, for example `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-`, with `/DIR` set to the installed location and a diagnostic log. Actual historical failures still need installer logs to attribute them to this mismatch. |
| Incomplete download lifecycle | Download IPC clears `pending` when `will-download` fires, so another active download can share the uncorrelated `download` event channel. Interrupted/paused states and a request that never produces `will-download` lack a complete timeout/retry contract. | Use operation IDs, one active update, terminal cleanup, cancellation, timeouts, resume/retry and an owned temporary directory. Commit progress to state only for the matching operation. |
| Replacement while running | Old workflow used synchronous installer spawning. The Inno script deletes `{app}\\*`; a running app/core or service can hold those files. macOS helper merges via `cp -R`, can retain stale files, assumes a mount-name regex and may report a downloaded target without a successful copy. | Use an external installer/helper after graceful app/core shutdown, handle service state, explicit exit codes, verified replacement, rollback and relaunch. Do not delete a live installation. For macOS use a structured mount result, signature verification, staging and cleanup in `finally`. |
| Missing integrity and format contract | Feed has URLs and names but no digest/signature, size or installer type. Download IPC accepts only exe/dmg; portable/Linux packages have no installer path. | Publish a versioned per-platform manifest with hashes, signatures and install types; verify in the main process before granting install capability. Define separate Windows installed/portable, macOS and Linux replacement adapters. |
| Network availability | Feed retrieval uses raw GitHub in the main process; downloads use the Electron session. There is no explicit common update proxy policy. The current feed has only a Windows x64 asset. | Make routing explicit and consistent, surface fetch failures separately from “up to date”, and publish assets for each advertised target. Failure on a specific network or a historical machine needs network logs to establish it. |

A practical restoration sequence is: publish and validate per-platform
metadata; implement a main-process download/verification state machine; add
Windows installation and rollback with exit-code reporting; then add macOS,
portable and Linux adapters. Test interrupted downloads, completion ordering,
wrong-architecture packages, failed signatures, UAC cancellation, non-default
installation paths, running services and rollback in isolated VMs. Native
installation must preserve the shared CFW data directory and service core hash
allow-lists. Only report “updated” after the new application starts and confirms
its version. Background download completion alone is not installation success.

References: [Inno Setup command-line parameters](https://jrsoftware.org/ishelp/topic_setupcmdline.htm),
[published update feed](https://raw.githubusercontent.com/Z-Siqi/Clash-for-Windows_Chinese/main/update).
