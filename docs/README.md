# Developer documentation

This directory documents the architecture, product invariants, decisions, and development procedures. Keep implementation-specific explanations beside the relevant code.

## Contents

- [`architecture/electron.md`](architecture/electron.md): Electron process boundaries, module layers, and IPC relationships.
- [`architecture/invariants.md`](architecture/invariants.md): Dual-core behavior, data directories, Service Mode, ports, and security boundaries.
- [`decisions/dual-core-support.md`](decisions/dual-core-support.md): Rationale and compatibility trade-offs for shipping legacy Clash and Mihomo together.
- [`development/testing.md`](development/testing.md): Cross-platform test commands, test layers, and contribution rules.
- [`development/releases.md`](development/releases.md): Release metadata, packaging, and update delivery.
- [`development/native-dependencies.md`](development/native-dependencies.md): Locked Mihomo downloads, caches, offline builds, and deliberate upgrades.
- [`development/macos-packaging.md`](development/macos-packaging.md): macOS app, DMG, signing, notarization, and release verification workflow.
- [`security-checks.md`](security-checks.md): CI security gates, coverage, and platform verification limits.

Update the relevant document when a stable constraint changes. For changes limited to a function's implementation, prefer updating code comments and tests.

## Document scope

Architecture documents describe the current system and its contracts. Decision
documents explain the rationale and trade-offs behind the design in use.
Development guides provide repeatable build, test and release procedures.
Known limitations belong beside the behavior they constrain, with a clear
distinction between implemented capabilities and unsupported operations.

Proposed work, priorities and completion tracking belong in GitHub issues or
Projects. Keep task lists, audit diaries and implementation roadmaps out of
these documents. Numbered instructions for an established procedure remain
appropriate; they describe how to perform an operation rather than its
development status.
