# Developer documentation

This directory contains stable, project-level guidance for maintainers. Keep implementation details in short comments near the relevant module. One-off investigations, session logs, and temporary refactoring status do not belong in long-lived documentation.

## Contents

- [`architecture/electron.md`](architecture/electron.md): Electron process boundaries, module layers, and IPC relationships.
- [`architecture/invariants.md`](architecture/invariants.md): Dual-core behavior, data directories, Service Mode, ports, and security boundaries.
- [`decisions/modularizing-legacy-bundles.md`](decisions/modularizing-legacy-bundles.md): How the legacy bundles were incrementally replaced by readable CommonJS entries.
- [`decisions/dual-core-support.md`](decisions/dual-core-support.md): How legacy Clash and Mihomo coexist.
- [`development/testing.md`](development/testing.md): Cross-platform test commands, test layers, and contribution rules.
- [`development/macos-packaging.md`](development/macos-packaging.md): macOS app, DMG, signing, notarization, and release verification workflow.

Update the relevant document when a stable constraint changes. For changes limited to a function's implementation, prefer updating code comments and tests.
