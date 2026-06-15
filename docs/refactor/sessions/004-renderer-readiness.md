# Session 004 - Renderer Readiness Observability

Date: 2026-06-13

## Goal

Build a fuller read-only renderer readiness observation foundation for the
packaged Electron app, without editing `app/main/dist/electron/main.js`,
`app/main/dist/electron/renderer.js`, or `app/main/node_modules/`.

## Starting State

- Worktree: `D:\Documents\CFW_Opt\Clash-for-Windows_Chinese-worktree`
- Branch: `codex/app-baseline-opt`
- Upstream: `origin/codex/app-baseline-opt`
- Initial baseline check passed.
- Existing runtime smoke passed.
- Session 002 and Session 003 files were present as working tree changes.
- `main.js` and `renderer.js` matched their recorded SHA256 baseline hashes.

## Changes Made

- Expanded `app/main/dist/electron/patch-layer/renderer-patch.js` with a
  richer runtime health contract:
  - version `004-renderer-readiness`
  - `eventCounts`
  - `scriptOrder`
  - `readyFlags`
  - `appRootPresent`
  - `recordEvent(...)`
  - `recordScript(...)`
- Kept `window.__CFW_PATCH_LAYER__` and `getHealth()` as the stable observation
  entry.
- Updated `runtime-smoke-probe.js` to record its script order and runtime-smoke
  ready flag.
- Added `app/main/dist/electron/patch-layer/renderer-readiness-probe.js`.
- Updated `index.html` so the runtime order is:
  - `renderer-patch.js`
  - `runtime-smoke-probe.js`
  - `renderer-readiness-probe.js`
  - `renderer.js`
- Added `scripts/refactor/check-renderer-readiness-smoke.js`.
- Updated `scripts/refactor/check-patch-layer-smoke.js`.
- Extended `scripts/refactor/check-baseline.ps1`.
- Updated `docs/refactor/CURRENT_STATE.md`.

## Runtime Behavior

The health surface can now report:

- `version`
- `loadedAt`
- `source`
- `probeCount`
- `documentReadyState`
- `locationHref`
- `hasDocumentElementDataset`
- `appRootPresent`
- `eventCounts`
- `scriptOrder`
- `readyFlags`
- `readyEventDispatched`
- `rendererReadinessSamples`
- `rendererReadinessSampleCount`

The readiness probe observes only browser/runtime facts:

- patch layer availability
- runtime smoke availability
- `cfw:patch-layer-ready`
- document lifecycle
- `#app` presence
- patch-layer dataset marker
- bounded readiness samples
- post-renderer marker visibility in smoke tests

It does not call IPC, write files, mutate Vue/Vuex state, import dependencies,
or intercept existing renderer behavior.

## Verification

Commands run:

```powershell
git -c safe.directory=D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree status --short --branch
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
node .\scripts\refactor\check-patch-layer-smoke.js
node --check app\main\dist\electron\patch-layer\renderer-patch.js
node --check app\main\dist\electron\patch-layer\runtime-smoke-probe.js
node --check app\main\dist\electron\patch-layer\renderer-readiness-probe.js
node --check scripts\refactor\check-patch-layer-smoke.js
node --check scripts\refactor\check-renderer-readiness-smoke.js
node .\scripts\refactor\check-renderer-readiness-smoke.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
Get-FileHash -LiteralPath app/main/dist/electron/main.js -Algorithm SHA256
Get-FileHash -LiteralPath app/main/dist/electron/renderer.js -Algorithm SHA256
```

Results:

- Initial baseline check passed.
- Existing runtime smoke passed.
- All JS syntax checks passed.
- Patch-layer smoke passed with version `004-renderer-readiness`, probe count
  `2`, and one ready event.
- Renderer readiness smoke passed with version `004-renderer-readiness`, probe
  count `9`, script order `renderer-patch.js -> runtime-smoke-probe.js ->
  renderer-readiness-probe.js -> mock-renderer.js`, and `6` readiness samples.
- Post-change baseline check passed.
- `main.js` SHA256 remained
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`.
- `renderer.js` SHA256 remained
  `7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B`.

## Build and Runtime Notes

Full packaging was not run. The Windows packaging script remains an explicit
approval step because it can run `npx`, install missing global packages, prompt
before deleting old output, and create packaged output.

Local build/runtime checks found:

- `npm.cmd` is available.
- `npx.cmd` is available.
- `app/main/node_modules` exists.
- `app/main/node_modules/electron` is not present.
- `app/main/node_modules/.bin/electron.cmd` is not present.
- `npm.cmd --prefix app/main ls electron --depth=0` found no local Electron
  dependency.
- `npm.cmd --prefix app/main ls electron-packager asar --depth=0` found no
  local packager dependencies.
- `npm.cmd --prefix app/main run` reported no package scripts.

Because no local Electron runtime is available under `app/main/node_modules`,
and the build script can install tools or delete output after prompts, the
closest safe verification path for this session is the Node VM renderer
readiness smoke.

## Next Step

Add one narrow read-only probe for a real renderer subsystem. Candidate probes:

- route readiness through observable URL/hash/state only
- store/module visibility without mutation
- IPC surface presence checks without invoking IPC

Keep `renderer.js`, `main.js`, and `node_modules` untouched.

## Rollback

```powershell
Remove-Item -Force .\app\main\dist\electron\patch-layer\renderer-readiness-probe.js
Remove-Item -Force .\scripts\refactor\check-renderer-readiness-smoke.js
Remove-Item -Force .\docs\refactor\sessions\004-renderer-readiness.md
```

Then remove the renderer readiness probe script tag from
`app/main/dist/electron/index.html`, restore the Session 003 versions of
`renderer-patch.js`, `runtime-smoke-probe.js`,
`scripts/refactor/check-patch-layer-smoke.js`, remove readiness checks from
`scripts/refactor/check-baseline.ps1`, and remove the Session 004 section from
`docs/refactor/CURRENT_STATE.md`.
