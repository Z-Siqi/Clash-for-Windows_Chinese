# Mihomo as a build dependency

Mihomo remains an independent core process. The repository tracks its dependency
manifest, license/source notices and Service Mode hash allow-lists, while its six
executable files are ignored build inputs. Existing core selection, resource paths,
controller policy and shared CFW data-directory behavior are unchanged.

## Normal development and packaging

Install dependencies with `npm ci` and `npm --prefix app/main ci`. Run `npm test`
or a normal `npm run package:<target>` command. The test runner prepares all six
platforms because portable asset and service tests inspect foreign architectures;
packaging prepares only its explicit target. The existing Windows and POSIX build
wrappers and release runner use that same packaging entry point.

`npm run mihomo:prepare` prepares the host target. Use `-- --all` to prefetch every
target, or repeat `--target <name>` to select specific targets. Supported names are
`win-x64`, `win-arm64`, `linux-x64`, `linux-arm64`, `mac-x64`, and `mac-arm64`.
The Linux/macOS service-helper build commands also prepare their target cores.

The single lockfile is `app/clash_core/mihomo-core-manifest.json`. Its exact version,
official upstream URLs, platform filenames and SHA-256 hashes must agree. The
resolver verifies the existing service allow-list before fetching anything, then
accepts only a matching binary with the correct executable format and CPU type.
Ordinary preparation never changes the lockfile, notices or service allow-lists.
Missing or corrupt inputs stop packaging if they cannot be restored and verified.

Verified executables are cached by digest under `app/build/dependencies/mihomo`.
Existing matching platform files can seed the cache without network access. A
custom `CFW_MIHOMO_CACHE` directory can be shared between checkouts; each cached
file is checked again before use. Do not place that directory in tracked source.
CI caches these files using the host OS and lockfile identity.

Set `CFW_MIHOMO_OFFLINE=1` for all preparation invoked by tests or packaging, or
pass `--offline` to `mihomo:prepare`. Missing or invalid cache entries produce an
error; the resolver never falls back to a floating version. Online requests support
`HTTPS_PROXY`/`https_proxy` and `HTTP_PROXY`/`http_proxy`, HTTPS redirects, bounded
download sizes and timeouts. ZIP paths are never extracted to disk; only the single
Mihomo executable is streamed to an owned staging file. Downloaded cores are not
executed by the resolver.

Preparation and updates take a checkout-local exclusive lock at
`app/build/dependencies/mihomo.lock`. Retry if another preparation is running. If a
process was forcibly terminated, confirm that it has stopped before removing this
lockfile and retrying. Staging directories are uniquely allocated and cleaned up
after success or failure.

## Deliberate version upgrades

Run `npm run mihomo:update -- <exact-version>` (an optional leading `v` is accepted).
The compatibility PowerShell entry point `app/update_mihomo_cores.ps1` requires
`-Version` and delegates to the same cross-platform updater.

The updater downloads official release assets for every supported target, validates
their formats and CPUs, and records the extracted hashes. For a new version, this
explicit command establishes the hashes that must be reviewed; later builds verify
against them. Resolving an already locked version rejects changed upstream bytes.
All platforms and associated metadata are staged before replacement. A download or
extraction failure leaves the previous release intact; a replacement failure rolls
back earlier replacements. This is a file transaction, not a crash-proof database:
after power loss, inspect the lockfile and rerun preparation before building.

Review and commit the manifest, six `MIHOMO_NOTICE.txt` files and six
`service/core-hashes.json` files. The latter preserve legacy Clash and macOS system
proxy helper hashes while pinning the new Mihomo digest. Run `npm test`, then the
appropriate platform packaging and runtime checks. Binaries and caches must stay
out of Git; an architecture test rejects indexed Mihomo executable paths.

This arrangement stops new binary revisions from accumulating. Existing binary
objects remain in Git history; no history rewriting or remote updates are part of
the dependency preparation or upgrade commands.
