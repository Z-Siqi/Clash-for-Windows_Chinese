# Session 003 - Runtime Smoke Probe

Date: 2026-06-13

## Goal

Build a verifiable runtime smoke and health check foundation for the packaged
Electron renderer patch layer, without editing `app/main/dist/electron/main.js`,
`app/main/dist/electron/renderer.js`, or `app/main/node_modules/`.

## Starting State

- Worktree: `D:\Documents\CFW_Opt\Clash-for-Windows_Chinese-worktree`
- Branch: `codex/app-baseline-opt`
- Upstream: `origin/codex/app-baseline-opt`
- Initial baseline check passed.
- Session 002 patch-layer files were present as working tree changes.
- `main.js` and `renderer.js` matched their recorded SHA256 baseline hashes.

## Changes Made

- Extended `app/main/dist/electron/patch-layer/renderer-patch.js` into a
  read-only core patch layer with:
  - `window.__CFW_PATCH_LAYER__`
  - `window.__CFW_PATCH_LAYER__.health`
  - `window.__CFW_PATCH_LAYER__.getHealth()`
  - `window.__CFW_PATCH_LAYER__.registerProbe(...)`
- Added `app/main/dist/electron/patch-layer/runtime-smoke-probe.js`.
- Updated `app/main/dist/electron/index.html` to load:
  - `patch-layer/renderer-patch.js`
  - `patch-layer/runtime-smoke-probe.js`
  - `renderer.js`
- Added `scripts/refactor/check-patch-layer-smoke.js`.
- Extended `scripts/refactor/check-baseline.ps1` to verify smoke files, script
  order, and key runtime API names.
- Updated `docs/refactor/CURRENT_STATE.md`.

## Runtime Behavior

The patch layer records only read-only runtime metadata:

- `version`
- `loadedAt`
- `source`
- `probeCount`
- `documentReadyState`
- `locationHref`
- `hasDocumentElementDataset`
- `readyEventDispatched`

The runtime smoke probe registers `runtime-smoke-probe-loaded` and dispatches
`cfw:patch-layer-ready`. It does not call IPC, write files, modify business
state, import packages, or intercept existing renderer behavior.

## Verification

Commands run:

```powershell
git -c safe.directory=D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree status --short --branch
git -c safe.directory=D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree status -uno
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
node --check app\main\dist\electron\patch-layer\renderer-patch.js
node --check app\main\dist\electron\patch-layer\runtime-smoke-probe.js
node --check scripts\refactor\check-patch-layer-smoke.js
node scripts\refactor\check-patch-layer-smoke.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Results:

- Initial baseline check passed.
- All JS syntax checks passed.
- Runtime smoke test passed.
- Post-change baseline check passed.
- Smoke output reported version `003-runtime-smoke`, probe count `2`, and one
  observed ready event.
- `main.js` and `renderer.js` baseline hashes still match.
- `index.html` loads the patch layer and runtime smoke probe before
  `renderer.js`.

## Build Notes

The packaged build script was not run. `app/build_win_x64.ps1` remains an
explicit verification step because it may call `npx`, install missing global
tools, prompt before deleting old output, and create packaged output.

## Next Step

Add one narrow read-only renderer readiness probe using the health surface as
the observation point. Keep it free of IPC calls, filesystem writes, state
mutation, and renderer bundle edits.

## Rollback

- Remove `app/main/dist/electron/patch-layer/runtime-smoke-probe.js`.
- Remove `scripts/refactor/check-patch-layer-smoke.js`.
- Remove the runtime smoke probe script tag from
  `app/main/dist/electron/index.html`.
- Restore the Session 002 `renderer-patch.js` behavior.
- Remove runtime smoke checks from `scripts/refactor/check-baseline.ps1`.
- Remove this session record and the Session 003 section in
  `docs/refactor/CURRENT_STATE.md`.
