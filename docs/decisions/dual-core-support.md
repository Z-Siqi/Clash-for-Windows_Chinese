# Dual-core support

The application ships Mihomo and legacy Clash. Mihomo is the default for new
settings; legacy Clash remains available for configurations and workflows that
depend on its behavior.

## Rationale

Legacy Clash provides continuity for existing users but does not support newer
protocols such as AnyTLS. Replacing it entirely would remove that compatibility,
while using it as the only core would exclude modern configurations. Shipping
both cores allows users to choose the implementation their configuration needs.

The common controller API makes shared pages and network operations practical,
but it does not make the two cores interchangeable in every detail. Routing
capabilities, configuration fields, version responses and logs still have
core-specific handling.

## Core selection

An explicit saved `settings.proxyCore` choice takes precedence over the default,
including an existing choice of legacy Clash. Changing the selection restarts
the active core. `core/clash-core/core-selection.js` owns the default policy and
the executable filename for each supported platform and architecture.

Capability checks determine which operations are available. For example, legacy
Clash supports Script routing mode while the packaged Mihomo does not. Pages,
shortcuts and tray actions use the same capability policy.

## Shared application data

Both cores receive the same CFW data directory explicitly, including in Service
Mode. Profiles, controller settings and UI preferences stay with the application
data rather than following the selected executable or the service account's
home directory.

Renderer features use the semantic Clash API. Core-specific translation stays
at the selection, response compatibility and configuration preparation
boundaries, so shared pages do not need separate controller implementations.
The related runtime contracts are described in
[product invariants](../architecture/invariants.md).

## Distribution and trust

The Service Mode allow-lists pin both packaged cores. Mihomo executables are
restored from a tracked dependency manifest containing upstream sources and
SHA-256 hashes; the executable downloads are not committed to Git. Tests and
packaging verify those hashes, and the explicit dependency updater changes the
lock, notices and service allow-lists together. See
[native dependency management](../development/native-dependencies.md).

Maintaining two cores requires compatibility coverage for both implementations.
The integration suite starts each packaged core over loopback and verifies
configuration application and dynamic port changes. These checks complement
the shared API tests; an identical API method name alone does not establish
equivalent native behavior.
