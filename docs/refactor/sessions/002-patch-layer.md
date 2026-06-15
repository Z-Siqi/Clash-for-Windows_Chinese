# Session 002 - Patch Layer

Date: 2026-06-13

## Goal

Create the first maintainable patch layer for the packaged Electron app without
editing `app/main/dist/electron/main.js`,
`app/main/dist/electron/renderer.js`, or `app/main/node_modules/`.

## Starting State

- Worktree: `D:\Documents\CFW_Opt\Clash-for-Windows_Chinese-worktree`
- Branch: `codex/app-baseline-opt`
- Upstream: `origin/codex/app-baseline-opt`
- Pre-change baseline check passed.
- Git required `-c safe.directory=D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree`
  because the repository owner differs from the current sandbox user.

## Changes Made

- Added `app/main/dist/electron/patch-layer/renderer-patch.js`.
- Updated `app/main/dist/electron/index.html` to load the patch layer before
  the existing `renderer.js` script.
- Updated `scripts/refactor/check-baseline.ps1` to require the patch file and
  verify script order.
- Updated `docs/refactor/CURRENT_STATE.md`.

## Patch Layer Behavior

`renderer-patch.js` is intentionally read-only. It:

- Defines `window.__CFW_PATCH_LAYER__`.
- Records `version`, `loadedAt`, `source`, `probes`, and `registerProbe`.
- Registers a `patch-layer-loaded` probe with the current document URL.
- Sets `document.documentElement.dataset.cfwPatchLayer` to
  `002-patch-layer` when a document is available.
- Dispatches `cfw:patch-layer-ready` for future runtime checks.

The patch layer does not import dependencies, call IPC, access the filesystem,
or change app business behavior.

## Verification

Commands run:

```powershell
git -c safe.directory=D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree status --short --branch
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
node --check app\main\dist\electron\patch-layer\renderer-patch.js
```

Results:

- Pre-change baseline check passed.
- Post-change baseline check passed.
- Patch layer JavaScript syntax check passed.
- `main.js` and `renderer.js` baseline hashes still match.
- `index.html` still loads `renderer.js`.
- `index.html` now loads `patch-layer/renderer-patch.js` before `renderer.js`.

## Build Notes

The packaged build script was not run automatically in this session.
`app/build_win_x64.ps1` may call `npx`, install missing global packages, prompt
before deleting old output, and create packaged output. Direct PowerShell calls
to `npm` and `npx` hit execution policy in this environment; use `npm.cmd` /
`npx.cmd` or run the provided script with explicit approval.

## Next Step

Use the patch layer for the next small, observable integration point, such as a
renderer smoke probe or runtime health check that can be inspected without
editing the old webpack bundle.

## Rollback

- Remove `app/main/dist/electron/patch-layer/renderer-patch.js`.
- Remove the patch-layer script tag from `app/main/dist/electron/index.html`.
- Remove patch-layer checks from `scripts/refactor/check-baseline.ps1`.
- Remove this session record and the Session 002 section in
  `docs/refactor/CURRENT_STATE.md`.
