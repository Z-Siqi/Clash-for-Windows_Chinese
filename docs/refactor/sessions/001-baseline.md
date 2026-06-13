# Session 001 - Baseline

Date: 2026-06-13

## Goal

Create the refactor baseline for the packaged Clash for Windows Electron app
without changing runtime business logic.

## Findings

- `D:\Documents\CFW_Opt` is not currently a git repository.
- Electron package root is `app/main`.
- `app/main/package.json` has `main: "./dist/electron/main.js"`.
- `app/main/dist/electron/main.js` creates a `BrowserWindow` and loads
  `file://${__dirname}/index.html`.
- `app/main/dist/electron/index.html` loads `renderer.js`.
- `renderer.js` is a large webpack bundle with no source map in the extracted
  app.
- `main.js` references `preload.js`, but `app/main/dist/electron/preload.js`
  is not present.
- Build scripts live under `app/build_*.ps1` and package `app/main` with
  `electron-packager`.

## Baseline Hashes

- `app/main/dist/electron/main.js`
  - SHA256: `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`
- `app/main/dist/electron/renderer.js`
  - SHA256: `7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B`
- `app/main/dist/electron/index.html`
  - SHA256: `BD44374E3CB128814A598459B3C21B5C409137C4878346B3967193B1F6E9B3A6`

These hashes are for the cloned `codex/app-baseline-opt` branch. They differ
from the earlier outer extracted package under `D:\Documents\CFW_Opt\app`.

## Changes Made

- Added refactor state documentation under `docs/refactor/`.
- Added `scripts/refactor/check-baseline.ps1`.

## Verification

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Expected:

- Baseline hashes match.
- Entry chain checks pass.
- Required dist files exist.

## Next Step

Initialize git, commit this baseline, then create the smallest patch-layer
entrypoint that can be loaded by the existing packaged app while preserving the
old renderer bundle.
