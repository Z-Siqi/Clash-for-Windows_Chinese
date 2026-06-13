# Current Refactor State

## Session 001 - Baseline

Date: 2026-06-13

This session created the refactor baseline for the packaged Electron app under
`app/`. It did not modify the packaged application logic.

## Completed This Session

- Inspected the current `app/` layout and confirmed the packaged Electron entry
  chain.
- Recorded the main runtime files, build scripts, known risks, and recommended
  refactor route.
- Added a read-only baseline verification script for later sessions.
- Confirmed the workspace root is not currently a git repository.

## Files Changed

- Added `docs/refactor/CURRENT_STATE.md`
- Added `docs/refactor/MODULE_MAP.md`
- Added `docs/refactor/DECISIONS.md`
- Added `docs/refactor/SESSION_TEMPLATE.md`
- Added `docs/refactor/sessions/001-baseline.md`
- Added `scripts/refactor/check-baseline.ps1`

No changes were made to:

- `app/main/dist/electron/main.js`
- `app/main/dist/electron/renderer.js`
- `app/main/dist/electron/index.html`
- `app/main/package.json`
- `app/main/node_modules/`

## Verification Results

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Expected result:

- `main.js` SHA256 matches the baseline.
- `renderer.js` SHA256 matches the baseline.
- `app/main/package.json` still points to `./dist/electron/main.js`.
- `app/main/dist/electron/index.html` still loads `renderer.js`.
- Required dist files are present.

Current baseline hashes:

- `main.js`: `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`
- `renderer.js`: `7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B`

Actual result from this session:

- Command run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1`
- Result: passed.
- Confirmed required dist files exist.
- Confirmed `main.js` and `renderer.js` match the baseline hashes.
- Confirmed `package.json` still points to `./dist/electron/main.js`.
- Confirmed `index.html` still loads `renderer.js`.
- Note: these hashes are for the cloned `codex/app-baseline-opt` worktree,
  whose app baseline differs from the earlier outer extracted package.

## Known Risks

- `renderer.js` is a large webpack bundle without a source map. Do not hand-edit
  it for feature work.
- `main.js` references `preload.js`, but `app/main/dist/electron/preload.js` is
  not present in the current extracted package.
- The build scripts can delete output folders and may install global packages
  (`electron-packager`, `asar`) if missing. Treat packaging as an explicit,
  separate verification step.
- The workspace root is not a git repository. Initialize git before starting
  refactor work that should be reviewed as commits or PR-sized changes.

## Next Conversation Task

Copy this task into the next Codex conversation:

```text
Continue the Electron refactor baseline from D:\Documents\CFW_Opt. First run
.\scripts\refactor\check-baseline.ps1. Then create the first maintainable patch
layer without editing renderer.js/main.js business logic directly. Prefer a
small, reversible integration point that can be loaded by the existing packaged
app and verified by the baseline script.
```

Recommended next step: initialize git in `D:\Documents\CFW_Opt`, commit this
baseline, then add the smallest possible patch-layer entrypoint.

## Rollback

Because this session only added docs and a read-only script, rollback is:

```powershell
Remove-Item -Recurse -Force .\docs\refactor, .\scripts\refactor
```

Do not remove or reset application files unless a separate git baseline exists.
