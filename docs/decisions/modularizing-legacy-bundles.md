# Modularizing legacy bundles incrementally

- Status: Completed
- Scope: `app/main/dist/electron`

## Context

The repository originally contained executable webpack bundles without the complete original Vue/Webpack source project. Decompiling, reformatting, or rebuilding all module identifiers at once would have created high-risk, hard-to-review changes.

## Decision

Extract one behavior at a time into CommonJS modules under `core/`, `features/`, or `entry/`. Inject Electron and operating-system dependencies, remove the superseded implementation, and protect ownership with behavioral and architecture tests. Once extraction is complete, replace the webpack runtimes with small named CommonJS entries and reject numeric loaders in architecture tests.

Decision filenames are descriptive and intentionally unnumbered. Their identity should remain stable without creating a sequence that contributors must continually reorder or extend.

## Current state

The main and renderer webpack runtimes have been removed, executable entries now use
named CommonJS composition, and every product area has a named owner. Extracted pages
and shared components use descriptive bindings and native async control flow; the old
numeric loaders, regenerator state machines, and short compatibility-property bridges
have been removed. Architecture tests reject those generated patterns and any new
single-character production binding.

## Consequences

- Behavior can be tested with fakes in Node without launching Electron for every change.
- `main.js` and `renderer.js` are now small executable entries rather than webpack runtimes.
- Vue behavior lives in named factories, with the original DOM and scope-ID contracts protected by tests.
- Historical `scripts/refactor/apply-*` migrations remain records and must not be rerun on the migrated tree.
