# Session 005 - Route Runtime Extraction

Date: 2026-06-15

Status update: this session was later reclassified as preparatory sidecar work,
not a completed enforced extraction. Session 006 changed `renderer.js` so the
old route/menu call sites delegate to `route-catalog.js`.

## Goal

Move beyond observation-only probes by extracting the first project-owned,
maintainable logic module for the packaged Electron renderer, while keeping
`app/main/dist/electron/main.js`, `app/main/dist/electron/renderer.js`, and
`app/main/node_modules/` untouched.

## Starting State

- Worktree:
  `D:\Documents\CFW_Opt\Clash-for-Windows_Chinese-worktree`
- Branch: `codex/app-baseline-opt`
- Upstream: `origin/codex/app-baseline-opt`
- Initial baseline check passed.
- Existing patch-layer smoke passed.
- Existing renderer readiness smoke passed.
- Session 002-004 files were present as working tree changes.
- `main.js` and `renderer.js` matched their recorded SHA256 baseline hashes.

## Changes Made

- Updated `app/main/dist/electron/patch-layer/renderer-patch.js`:
  - version `005-route-runtime-extraction`
  - `getHealth()` now includes a copy of `probes`
  - health now includes `routeCatalog`, `routeReadiness`,
    `storeModuleVisibility`, and `ipcSurfacePresence`
  - ready flags now include route/store/ipc probe load state
- Added `app/main/dist/electron/patch-layer/routes/route-catalog.js`.
- Added `app/main/dist/electron/patch-layer/route-readiness-probe.js`.
- Added
  `app/main/dist/electron/patch-layer/store-module-visibility-probe.js`.
- Added `app/main/dist/electron/patch-layer/ipc-surface-presence-probe.js`.
- Updated `app/main/dist/electron/index.html` to load the new project-owned
  scripts before the old `renderer.js`.
- Added `scripts/refactor/check-route-catalog-smoke.js`.
- Updated the existing smoke scripts for the Session 005 health version.
- Extended `scripts/refactor/check-baseline.ps1` with the new files, health
  fields, probe names, event names, and script-order requirements.
- Updated `docs/refactor/CURRENT_STATE.md`.

## Extracted Logic

`route-catalog.js` is the first extracted logic module. It models the known
renderer route table observed from `renderer.js`:

- `/home/general`
- `/home/proxy`
- `/home/provider`
- `/home/log`
- `/home/server`
- `/home/connection`
- `/home/router`
- `/home/setting`
- `/home/about`

The catalog includes route ids, child paths, menu keys, title keys, keep-alive
flags, menu visibility, and renderer module/chunk hints. It exposes read-only
helpers for route listing and matching:

- `getRoutes()`
- `getMenuRoutes()`
- `normalizePath(...)`
- `findRouteByPath(...)`
- `matchRouteFromLocation(...)`

The route readiness probe uses this module to match observed location state and
report the result through `window.__CFW_PATCH_LAYER__.health` and `probes`.
This is intentionally not a Vue Router takeover. It does not navigate, replace
routes, mutate Vuex, commit `SET_CURRENT_ROUTE_PATH`, or change the old bundle.

## Runtime Probes

- Route readiness probe:
  - observes `location.href`, `location.hash`, `location.pathname`
  - matches the observed location against the extracted route catalog
  - records visible DOM signals such as `#app` presence
  - records `route-readiness:hashchange` if hash changes
- Store/module visibility probe:
  - observes whether `#app.__vue__`, `$store`, `$router`, `$route`, Vue
    devtools hook, and webpack-like globals are visible
  - records store state/getter key names only
  - does not call mutations or actions
- IPC surface presence probe:
  - checks whether `require("electron")` and `ipcRenderer` are present
  - records method names and Electron/process metadata
  - does not call `send`, `invoke`, `on`, or any business IPC channel

## Build and Runtime Verification

Full packaging and real Electron launch were not run in this session.

Checks found:

- `npm.cmd` is available.
- `npx.cmd` is available.
- `app/main/node_modules` exists.
- local `electron` is not installed.
- local `app/main/node_modules/.bin/electron.cmd` is not installed.
- local `electron-packager` and `asar` are not installed.
- global `electron`, `electron-packager`, and `asar` commands are not
  available.
- `npm.cmd --prefix app/main run` produced no package scripts.
- `npx.cmd --no-install electron`, `electron-packager`, and `asar` attempted
  npm registry access and failed in the restricted environment.
- `app/build_win_x64.ps1` may install global tools, prompt before deleting old
  output, and create packaged output, so it was not run without explicit
  approval.
- The in-app browser verification path was attempted, but Windows sandbox
  process creation failed before the local page could be opened.

The closest completed renderer-like verification is
`scripts/refactor/check-route-catalog-smoke.js`, which loads the patch-layer
script chain in a Node VM, mocks read-only browser/Electron renderer globals,
and verifies `window.__CFW_PATCH_LAYER__.getHealth()`.

## Verification

Commands run:

```powershell
git -c safe.directory=D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree status --short --branch
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
node .\scripts\refactor\check-patch-layer-smoke.js
node .\scripts\refactor\check-renderer-readiness-smoke.js
Get-Command npm.cmd
Get-Command npx.cmd
Test-Path -LiteralPath app\main\node_modules
Test-Path -LiteralPath app\main\node_modules\electron
Test-Path -LiteralPath app\main\node_modules\.bin\electron.cmd
npm.cmd --prefix app/main run
npm.cmd --prefix app/main ls electron --depth=0
npm.cmd --prefix app/main ls electron-packager asar --depth=0
npx.cmd --no-install electron --version
npx.cmd --no-install electron-packager --version
npx.cmd --no-install asar --version
Get-Command electron -ErrorAction SilentlyContinue
Get-Command electron.cmd -ErrorAction SilentlyContinue
Get-Command electron-packager -ErrorAction SilentlyContinue
Get-Command asar -ErrorAction SilentlyContinue
node --check app\main\dist\electron\patch-layer\renderer-patch.js
node --check app\main\dist\electron\patch-layer\runtime-smoke-probe.js
node --check app\main\dist\electron\patch-layer\renderer-readiness-probe.js
node --check app\main\dist\electron\patch-layer\routes\route-catalog.js
node --check app\main\dist\electron\patch-layer\route-readiness-probe.js
node --check app\main\dist\electron\patch-layer\store-module-visibility-probe.js
node --check app\main\dist\electron\patch-layer\ipc-surface-presence-probe.js
node --check scripts\refactor\check-patch-layer-smoke.js
node --check scripts\refactor\check-renderer-readiness-smoke.js
node --check scripts\refactor\check-route-catalog-smoke.js
node .\scripts\refactor\check-patch-layer-smoke.js
node .\scripts\refactor\check-renderer-readiness-smoke.js
node .\scripts\refactor\check-route-catalog-smoke.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
Get-FileHash -LiteralPath app/main/dist/electron/main.js -Algorithm SHA256
Get-FileHash -LiteralPath app/main/dist/electron/renderer.js -Algorithm SHA256
git -c safe.directory=D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree diff --check
git -c safe.directory=D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree status --short --branch
```

Results:

- Baseline passed before and after changes.
- Patch-layer smoke passed with version `005-route-runtime-extraction`, probe
  count `2`, and one ready event.
- Renderer readiness smoke passed with version
  `005-route-runtime-extraction`, probe count `9`, script order
  `renderer-patch.js -> runtime-smoke-probe.js ->
  renderer-readiness-probe.js -> mock-renderer.js`, and `6` readiness samples.
- Route catalog smoke passed with version `005-route-runtime-extraction`, route
  count `9`, matched route `proxy`, and probe count `19`.
- All JS syntax checks passed.
- `git -c safe.directory=D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree diff --check`
  passed, with Git LF-to-CRLF working-copy warnings for tracked text files.
- `main.js` SHA256 remained
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`.
- `renderer.js` SHA256 remained
  `7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B`.

## Next Step

Use the extracted route catalog as the stable sidecar model for one live
equivalence check. Recommended next session:

- run/approve a real Electron launch path if packaging/runtime tools are
  available;
- compare live `$route.path` or stored `currentRoutePath` against
  `routeCatalog.matchRouteFromLocation(...)`;
- optionally extract menu route metadata as a second small module using the
  same route ids.

## Rollback

```powershell
Remove-Item -Force .\app\main\dist\electron\patch-layer\routes\route-catalog.js
Remove-Item -Force .\app\main\dist\electron\patch-layer\route-readiness-probe.js
Remove-Item -Force .\app\main\dist\electron\patch-layer\store-module-visibility-probe.js
Remove-Item -Force .\app\main\dist\electron\patch-layer\ipc-surface-presence-probe.js
Remove-Item -Force .\scripts\refactor\check-route-catalog-smoke.js
Remove-Item -Force .\docs\refactor\sessions\005-route-runtime-extraction.md
```

Then remove the Session 005 script tags from
`app/main/dist/electron/index.html`, restore the Session 004 versions of
`renderer-patch.js`, `scripts/refactor/check-patch-layer-smoke.js`,
`scripts/refactor/check-renderer-readiness-smoke.js`, remove Session 005 checks
from `scripts/refactor/check-baseline.ps1`, and remove the Session 005 section
from `docs/refactor/CURRENT_STATE.md`.
