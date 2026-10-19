# Supporting legacy Clash and Mihomo

- Status: Accepted
- Scope: Core selection, configuration, Service Mode, and UI

## Context

Legacy Clash preserves compatibility with existing configurations and established workflows, but it does not support newer protocols such as AnyTLS. Replacing it outright would break existing users, while keeping it as the only core would block modern configurations.

## Decision

Use Mihomo as the default for new settings, while preserving saved explicit `settings.proxyCore` choices including legacy Clash. Both cores use the same CFW data directory and controller API abstraction, and switching cores restarts the active core. `core-selection.js` is the single owner of platform-specific filenames and the default core policy.

Mihomo assets record their upstream source and SHA-256. Both cores must pass integration tests covering local API startup and dynamic port changes. The Service Mode allow-list pins both sets of binaries.

Mihomo executables are restored as external build dependencies from the tracked
manifest, rather than committed to Git. Tests and packaging verify the locked
hashes; only the explicit updater changes the lock and service allow-lists. See
[native dependency management](../development/native-dependencies.md).

## Consequences

The UI, logs, and connections views depend only on the Clash-compatible API. Core-specific behavior stays at the selection, version/log compatibility, and configuration-serialization boundaries.
