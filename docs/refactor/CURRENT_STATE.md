# Current Refactor State

## Session 006 - Enforced Route Delegation

Date: 2026-06-15

This session corrected the Session 005 sidecar-only route extraction into an
enforced extraction. The packaged `renderer.js` now delegates its old menu item
construction and Vue Router route construction to the project-owned route
catalog. Deleting `patch-layer/routes/route-catalog.js` now breaks the renderer
call path and baseline verification for this extracted behavior.

`main.js` was inspected and left unchanged because it owns BrowserWindow and
`index.html` loading only; it does not contain the route/menu logic extracted
in this step.

## Completed This Session

- Updated planning documents to define real extraction as old-code delegation,
  not sidecar duplication:
  - `docs/refactor/DECISIONS.md`
  - `docs/refactor/SESSION_TEMPLATE.md`
  - `docs/refactor/MODULE_MAP.md`
- Extended `app/main/dist/electron/patch-layer/routes/route-catalog.js` with:
  - `buildMenuItems(language)`
  - `buildVueRouterRoutes(moduleResolver)`
  - route component/chunk mapping ownership for the `/home/*` children
  - menu metadata ownership for visible navigation items
- Replaced the old inline `renderer.js` `menuItems: [...]` block with:
  - `window.__CFW_ROUTE_CATALOG__.buildMenuItems(Lg)`
- Replaced the old inline Vue Router `routes: [...]` block with:
  - `window.__CFW_ROUTE_CATALOG__.buildVueRouterRoutes(o)`
- Extended `scripts/refactor/check-baseline.ps1` so it now:
  - accepts the new enforced `renderer.js` hash
  - fails if `renderer.js` still has the legacy pre-extraction hash
  - requires the renderer delegate calls to the route catalog
  - fails if old inline route/menu anchor text remains
- Extended `scripts/refactor/check-route-catalog-smoke.js` to verify the route
  catalog builds equivalent menu items and Vue Router route objects.
- Added `docs/refactor/sessions/006-enforced-route-delegation.md`.

## Files Changed

- Updated `app/main/dist/electron/renderer.js`
- Updated `app/main/dist/electron/patch-layer/routes/route-catalog.js`
- Updated `scripts/refactor/check-baseline.ps1`
- Updated `scripts/refactor/check-route-catalog-smoke.js`
- Updated `docs/refactor/CURRENT_STATE.md`
- Updated `docs/refactor/DECISIONS.md`
- Updated `docs/refactor/SESSION_TEMPLATE.md`
- Updated `docs/refactor/MODULE_MAP.md`
- Updated `docs/refactor/sessions/005-route-runtime-extraction.md`
- Added `docs/refactor/sessions/006-enforced-route-delegation.md`

No changes were made to:

- `app/main/dist/electron/main.js`
- `app/main/node_modules/`

## Enforced Extraction Boundary

The extracted route catalog now owns:

- the visible menu route list previously initialized inline in Vuex app state;
- the Vue Router `/home` route tree previously initialized inline in
  `renderer.js`;
- route ids, paths, child paths, title keys, keep-alive flags, visibility, and
  module/chunk hints for the extracted route surface.

The old renderer still owns the broader Vue app, Vuex store, and navigation
runtime. This session only delegates construction of the route/menu structures.

## Verification Results

Actual result from this session:

- `main.js` inspected for `/home`, `router`, `menuItems`, and renderer loading
  ownership. No route/menu extraction target exists in `main.js`.
- `renderer.js` syntax check passed after the narrow bundle edit.
- `route-catalog.js` syntax check passed.
- `node .\scripts\refactor\check-route-catalog-smoke.js`: passed with version
  `006-enforced-route-delegation`, route count `9`, matched route `proxy`, and
  probe count `19`.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1`:
  passed.
- Baseline now verifies that:
  - `renderer.js` delegates menu item construction to the route catalog.
  - `renderer.js` delegates Vue Router construction to the route catalog.
  - the old inline `menuItems: [{` block is gone.
  - the old inline `routes: [{` block is gone.
  - the old direct `/home` component mapping anchor is gone.
  - the old direct `path: "general"` child route literal is gone.
- `main.js` SHA256 remains
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`.
- `renderer.js` SHA256 is now
  `E0A54DC7914C441880BD12B84A91F91979CA128CED9886C4EFDCCBA545BE0E5C`.

## Rollback

Rollback for this session:

1. Restore the Session 005 `renderer.js` route/menu inline blocks:
   - replace `window.__CFW_ROUTE_CATALOG__.buildMenuItems(Lg)` with the
     previous seven-item `menuItems` array;
   - replace `window.__CFW_ROUTE_CATALOG__.buildVueRouterRoutes(o)` with the
     previous inline Vue Router route tree.
2. Restore the previous `route-catalog.js` without builder APIs.
3. Restore the previous baseline expected renderer hash
   `7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B`.
4. Remove the Session 006 checks from `check-baseline.ps1` and
   `check-route-catalog-smoke.js`.

## Session 005 - Route Runtime Extraction

Date: 2026-06-15

This session prepared the first route extraction but did not complete enforced
delegation by itself. It added a project-owned route catalog that models the
packaged renderer's known `/home/*` routes and is consumed by a read-only route
readiness probe. Session 006 later converted this sidecar catalog into a real
dependency by changing `renderer.js` to call it.

## Completed This Session

- Updated `app/main/dist/electron/patch-layer/renderer-patch.js` to version
  `005-route-runtime-extraction`.
- Kept `window.__CFW_PATCH_LAYER__`,
  `window.__CFW_PATCH_LAYER__.health`, and
  `window.__CFW_PATCH_LAYER__.getHealth()` as the stable observation entry.
- Added `app/main/dist/electron/patch-layer/routes/route-catalog.js`.
  - Extracts route id, path, menu key, title key, keep-alive status, and
    renderer module/chunk hints observed from `renderer.js`.
  - Exposes `window.__CFW_ROUTE_CATALOG__`.
  - Provides read-only helpers such as `getRoutes()`, `getMenuRoutes()`,
    `normalizePath(...)`, `findRouteByPath(...)`, and
    `matchRouteFromLocation(...)`.
- Added read-only runtime probes:
  - `route-readiness-probe.js`
  - `store-module-visibility-probe.js`
  - `ipc-surface-presence-probe.js`
- Updated `app/main/dist/electron/index.html` so the script order is:
  - `patch-layer/renderer-patch.js`
  - `patch-layer/runtime-smoke-probe.js`
  - `patch-layer/renderer-readiness-probe.js`
  - `patch-layer/routes/route-catalog.js`
  - `patch-layer/route-readiness-probe.js`
  - `patch-layer/store-module-visibility-probe.js`
  - `patch-layer/ipc-surface-presence-probe.js`
  - `renderer.js`
- Added `scripts/refactor/check-route-catalog-smoke.js`, a dependency-free
  Node VM smoke that verifies the extracted route catalog, matching rules,
  health output, probe names, and script order.
- Updated `scripts/refactor/check-patch-layer-smoke.js` and
  `scripts/refactor/check-renderer-readiness-smoke.js` for the Session 005
  health version.
- Extended `scripts/refactor/check-baseline.ps1` to require the route catalog,
  route/store/ipc probes, route smoke script, stable pass signal, health fields,
  probe names, event names, and script ordering.

The new probes remain read-only. They do not call IPC business channels, do not
invoke or send IPC messages, do not write files, do not mutate Vue/Vuex state,
do not edit dependencies, and do not intercept old renderer behavior.

## Files Changed

- Updated `app/main/dist/electron/index.html`
- Updated `app/main/dist/electron/patch-layer/renderer-patch.js`
- Added `app/main/dist/electron/patch-layer/routes/route-catalog.js`
- Added `app/main/dist/electron/patch-layer/route-readiness-probe.js`
- Added `app/main/dist/electron/patch-layer/store-module-visibility-probe.js`
- Added `app/main/dist/electron/patch-layer/ipc-surface-presence-probe.js`
- Updated `scripts/refactor/check-baseline.ps1`
- Updated `scripts/refactor/check-patch-layer-smoke.js`
- Updated `scripts/refactor/check-renderer-readiness-smoke.js`
- Added `scripts/refactor/check-route-catalog-smoke.js`
- Updated `docs/refactor/CURRENT_STATE.md`
- Added `docs/refactor/sessions/005-route-runtime-extraction.md`

No changes were made to:

- `app/main/dist/electron/main.js`
- `app/main/dist/electron/renderer.js`
- `app/main/node_modules/`

## First Extracted Logic Boundary

At the end of Session 005, the extracted route catalog was still a sidecar
model, not a router replacement. It recorded route metadata observed from the
packaged renderer:

- `/home/general`
- `/home/proxy`
- `/home/provider`
- `/home/log`
- `/home/server`
- `/home/connection`
- `/home/router`
- `/home/setting`
- `/home/about`

The route readiness probe consumed this catalog to match `location.hash`,
`location.pathname`, and fallback route behavior. It reported the result into
`window.__CFW_PATCH_LAYER__.health.routeCatalog`, `health.routeReadiness`, and
`probes`, but it did not replace or feed Vue Router until Session 006.

## Build and Runtime Notes

Full packaging and real Electron launch were not run. The checked environment
does not currently have local or global `electron`, `electron-packager`, or
`asar` commands available. `npx.cmd --no-install` attempted registry access and
failed under the restricted environment, and `app/build_win_x64.ps1` may install
global npm tools, prompt before deleting output, and create packaged output.

The closest completed runtime verification is the dependency-free Node VM
renderer simulation. It loads the patch layer, runtime smoke probe, readiness
probe, route catalog, route readiness probe, store/module visibility probe, IPC
surface probe, and a mock post-renderer marker, then reads
`window.__CFW_PATCH_LAYER__.getHealth()`.

An in-app browser attempt to open a local page was also blocked by Windows
sandbox process-creation permissions, so it was not used as a verification
result.

## Verification Results

Actual result from this session:

- Initial git branch/status check: on `codex/app-baseline-opt`, tracking
  `origin/codex/app-baseline-opt`, with expected Session 002-004 working tree
  changes already present.
- Initial baseline check: passed.
- Initial patch-layer smoke: passed.
- Initial renderer-readiness smoke: passed.
- Package/tool checks:
  - `npm.cmd` is available.
  - `npx.cmd` is available.
  - `app/main/node_modules` exists.
  - local `electron` is not installed.
  - local `.bin/electron.cmd` is not installed.
  - local `electron-packager` and `asar` are not installed.
  - global `electron`, `electron-packager`, and `asar` commands are not
    available.
  - `app/main/package.json` has no package scripts.
- Post-change JS syntax checks passed for all patch-layer JS files and smoke
  scripts.
- `node .\scripts\refactor\check-patch-layer-smoke.js`: passed.
- `node .\scripts\refactor\check-renderer-readiness-smoke.js`: passed.
- `node .\scripts\refactor\check-route-catalog-smoke.js`: passed with version
  `005-route-runtime-extraction`, route count `9`, matched route `proxy`, and
  probe count `19`.
- Post-change baseline check: passed.
- Confirmed `main.js` SHA256 still matches
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`.
- Confirmed `renderer.js` SHA256 still matches
  `7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B`.
- `git -c safe.directory=D:/Documents/CFW_Opt/Clash-for-Windows_Chinese-worktree diff --check`:
  passed, with Git LF-to-CRLF working-copy warnings for tracked text files.

## Build and Test Path

Run the baseline check from the worktree root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Run all smoke tests:

```powershell
node .\scripts\refactor\check-patch-layer-smoke.js
node .\scripts\refactor\check-renderer-readiness-smoke.js
node .\scripts\refactor\check-route-catalog-smoke.js
```

Run syntax checks for patch-layer and smoke JS files:

```powershell
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
```

## Next Conversation Task

Use the route catalog as the first stable extracted model and add one narrowly
bounded equivalence check against live renderer state. Good candidates:

- Read current route/store state after real Electron launch and compare it to
  `routeCatalog.matchRouteFromLocation(...)`.
- Add a read-only menu item catalog derived from the same route ids.
- Add a small tool-assisted Electron launch path once local Electron or
  packaging tools are explicitly approved/installed.

## Rollback

Rollback for this session:

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
`app/main/dist/electron/patch-layer/renderer-patch.js`,
`scripts/refactor/check-patch-layer-smoke.js`, and
`scripts/refactor/check-renderer-readiness-smoke.js`, remove Session 005 checks
from `scripts/refactor/check-baseline.ps1`, and remove this Session 005 section
from `docs/refactor/CURRENT_STATE.md`.

## Session 004 - Renderer Readiness Observability

Date: 2026-06-13

This session expanded the read-only runtime health surface into a renderer
readiness observability foundation. The old app entry chain still loads the
original `renderer.js`, and the original `main.js` and `renderer.js` baseline
hashes remain unchanged.

## Completed This Session

- Expanded `app/main/dist/electron/patch-layer/renderer-patch.js` with:
  - `version` `004-renderer-readiness`
  - `eventCounts`
  - `scriptOrder`
  - `readyFlags`
  - `appRootPresent`
  - `recordEvent(...)`
  - `recordScript(...)`
- Kept `window.__CFW_PATCH_LAYER__`,
  `window.__CFW_PATCH_LAYER__.health`, and
  `window.__CFW_PATCH_LAYER__.getHealth()` as the stable observation entry.
- Updated `runtime-smoke-probe.js` so it records script order and the
  runtime-smoke ready flag before dispatching `cfw:patch-layer-ready`.
- Added `app/main/dist/electron/patch-layer/renderer-readiness-probe.js`.
- Updated `app/main/dist/electron/index.html` so the script order is:
  - `patch-layer/renderer-patch.js`
  - `patch-layer/runtime-smoke-probe.js`
  - `patch-layer/renderer-readiness-probe.js`
  - `renderer.js`
- Added `scripts/refactor/check-renderer-readiness-smoke.js`, a dependency-free
  Node smoke test that simulates the renderer loading order with a mock
  post-renderer marker.
- Updated `scripts/refactor/check-patch-layer-smoke.js` for the expanded health
  contract.
- Extended `scripts/refactor/check-baseline.ps1` to require the readiness probe,
  the readiness smoke script, script order checks, runtime health API names,
  event names, and probe names.

The patch layer remains read-only. It does not call IPC, write files, edit
business state, import dependencies, or intercept existing renderer behavior.

## Files Changed

- Updated `app/main/dist/electron/index.html`
- Updated `app/main/dist/electron/patch-layer/renderer-patch.js`
- Updated `app/main/dist/electron/patch-layer/runtime-smoke-probe.js`
- Added `app/main/dist/electron/patch-layer/renderer-readiness-probe.js`
- Updated `scripts/refactor/check-baseline.ps1`
- Updated `scripts/refactor/check-patch-layer-smoke.js`
- Added `scripts/refactor/check-renderer-readiness-smoke.js`
- Updated `docs/refactor/CURRENT_STATE.md`
- Added `docs/refactor/sessions/004-renderer-readiness.md`

No changes were made to:

- `app/main/dist/electron/main.js`
- `app/main/dist/electron/renderer.js`
- `app/main/node_modules/`

## Build and Test Path

Run the baseline check from the worktree root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Run the smoke tests:

```powershell
node .\scripts\refactor\check-patch-layer-smoke.js
node .\scripts\refactor\check-renderer-readiness-smoke.js
```

Run syntax checks for all patch-layer and smoke JS files:

```powershell
node --check app\main\dist\electron\patch-layer\renderer-patch.js
node --check app\main\dist\electron\patch-layer\runtime-smoke-probe.js
node --check app\main\dist\electron\patch-layer\renderer-readiness-probe.js
node --check scripts\refactor\check-patch-layer-smoke.js
node --check scripts\refactor\check-renderer-readiness-smoke.js
```

Packaging remains an explicit follow-up step. Do not automatically run
`app/build_win_x64.ps1` without confirmation because it calls `npx`, may install
missing global tools, prompts before deleting old output, and creates packaged
output.

## Verification Results

Actual result from this session:

- Initial baseline check: passed.
- Existing patch-layer smoke before changes: passed.
- Post-change baseline check: passed.
- `node --check app\main\dist\electron\patch-layer\renderer-patch.js`: passed.
- `node --check app\main\dist\electron\patch-layer\runtime-smoke-probe.js`:
  passed.
- `node --check app\main\dist\electron\patch-layer\renderer-readiness-probe.js`:
  passed.
- `node --check scripts\refactor\check-patch-layer-smoke.js`: passed.
- `node --check scripts\refactor\check-renderer-readiness-smoke.js`: passed.
- `node .\scripts\refactor\check-patch-layer-smoke.js`: passed.
- `node .\scripts\refactor\check-renderer-readiness-smoke.js`: passed.
- Readiness smoke reported version `004-renderer-readiness`, probe count `9`,
  script order `renderer-patch.js -> runtime-smoke-probe.js ->
  renderer-readiness-probe.js -> mock-renderer.js`, and `6` readiness samples.
- Confirmed `index.html` loads the patch layer, runtime smoke probe, and
  renderer readiness probe before `renderer.js`.
- Confirmed `main.js` SHA256 still matches
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`.
- Confirmed `renderer.js` SHA256 still matches
  `7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B`.

## Build and Runtime Notes

Full packaging was not run in this session. `app/build_win_x64.ps1` checks
`npx electron-packager` and `npx asar`, may install both globally if missing,
prompts before deleting existing output, and creates packaged output. Current
local checks found:

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

The closest safe renderer verification path for this session is the dependency
free Node VM readiness smoke, which exercises the intended script order,
document lifecycle, `#app` presence, ready event observation, dataset marker,
post-renderer marker observation, and bounded readiness sampling.

## Next Conversation Task

Use `window.__CFW_PATCH_LAYER__.getHealth()` as the stable observation point for
the first narrow runtime-facing extraction. A good next task is to add one
read-only, named probe for route readiness or store/module visibility that only
observes public runtime state and keeps `renderer.js` intact.

## Rollback

Rollback for this session:

```powershell
Remove-Item -Force .\app\main\dist\electron\patch-layer\renderer-readiness-probe.js
Remove-Item -Force .\scripts\refactor\check-renderer-readiness-smoke.js
Remove-Item -Force .\docs\refactor\sessions\004-renderer-readiness.md
```

Then remove the renderer readiness probe script tag from
`app/main/dist/electron/index.html`, restore the Session 003 versions of
`app/main/dist/electron/patch-layer/renderer-patch.js`,
`app/main/dist/electron/patch-layer/runtime-smoke-probe.js`,
`scripts/refactor/check-patch-layer-smoke.js`, remove readiness checks from
`scripts/refactor/check-baseline.ps1`, and remove this Session 004 section from
`docs/refactor/CURRENT_STATE.md`.

## Session 003 - Runtime Smoke Probe

Date: 2026-06-13

This session extended the renderer patch layer into a verifiable runtime health
check surface. The old app entry chain still loads the original `renderer.js`,
and the original `main.js` and `renderer.js` baseline hashes remain unchanged.

## Completed This Session

- Expanded `app/main/dist/electron/patch-layer/renderer-patch.js` into a
  read-only core that exposes `window.__CFW_PATCH_LAYER__`,
  `window.__CFW_PATCH_LAYER__.health`, and
  `window.__CFW_PATCH_LAYER__.getHealth()`.
- Added `app/main/dist/electron/patch-layer/runtime-smoke-probe.js` to register
  a runtime probe and dispatch `cfw:patch-layer-ready`.
- Updated `app/main/dist/electron/index.html` so the runtime smoke probe loads
  after the patch layer and before `renderer.js`.
- Added `scripts/refactor/check-patch-layer-smoke.js`, a dependency-free Node
  smoke test that simulates the minimum browser/Electron renderer globals.
- Extended `scripts/refactor/check-baseline.ps1` to require the smoke files,
  verify script order, and check the key runtime API names.

The patch layer remains read-only. It does not call IPC, write files, edit
business state, import dependencies, or intercept old app behavior.

## Files Changed

- Updated `app/main/dist/electron/index.html`
- Updated `app/main/dist/electron/patch-layer/renderer-patch.js`
- Added `app/main/dist/electron/patch-layer/runtime-smoke-probe.js`
- Updated `scripts/refactor/check-baseline.ps1`
- Added `scripts/refactor/check-patch-layer-smoke.js`
- Updated `docs/refactor/CURRENT_STATE.md`
- Added `docs/refactor/sessions/003-runtime-smoke.md`

No changes were made to:

- `app/main/dist/electron/main.js`
- `app/main/dist/electron/renderer.js`
- `app/main/package.json`
- `app/main/node_modules/`

## Build and Test Path

Run the baseline check from the worktree root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Run the runtime smoke test:

```powershell
node .\scripts\refactor\check-patch-layer-smoke.js
```

Run syntax checks for all new or changed JS files:

```powershell
node --check app\main\dist\electron\patch-layer\renderer-patch.js
node --check app\main\dist\electron\patch-layer\runtime-smoke-probe.js
node --check scripts\refactor\check-patch-layer-smoke.js
```

Packaging remains an explicit follow-up step. Do not automatically run
`app/build_win_x64.ps1` without confirmation because it may call `npx`, install
missing global tools, prompt before deleting old output, and create packaged
output.

## Verification Results

Actual result from this session:

- Initial baseline check: passed.
- Post-change baseline check: passed.
- `node --check app\main\dist\electron\patch-layer\renderer-patch.js`: passed.
- `node --check app\main\dist\electron\patch-layer\runtime-smoke-probe.js`:
  passed.
- `node --check scripts\refactor\check-patch-layer-smoke.js`: passed.
- `node .\scripts\refactor\check-patch-layer-smoke.js`: passed.
- Smoke result confirmed version `003-runtime-smoke`, probe count `2`, and one
  observed `cfw:patch-layer-ready` event.
- Confirmed `index.html` loads `renderer-patch.js`, then
  `runtime-smoke-probe.js`, then `renderer.js`.
- Confirmed `main.js` SHA256 still matches
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`.
- Confirmed `renderer.js` SHA256 still matches
  `7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B`.

## Next Conversation Task

Use the runtime health surface as the stable observation point for the next
small extraction. A good next task is to add a read-only probe for one narrow
renderer subsystem, such as route/app readiness signals that can be observed
without mutating Vue, Vuex, IPC, or the old bundle.

## Rollback

Rollback for this session:

```powershell
Remove-Item -Force .\app\main\dist\electron\patch-layer\runtime-smoke-probe.js
Remove-Item -Force .\scripts\refactor\check-patch-layer-smoke.js
Remove-Item -Force .\docs\refactor\sessions\003-runtime-smoke.md
```

Then remove the runtime smoke probe script tag from
`app/main/dist/electron/index.html`, restore the Session 002 version of
`app/main/dist/electron/patch-layer/renderer-patch.js`, remove the runtime
smoke checks from `scripts/refactor/check-baseline.ps1`, and remove this
Session 003 section from `docs/refactor/CURRENT_STATE.md`.

## Session 002 - Patch Layer

Date: 2026-06-13

This session added the first maintainable renderer-side patch layer for the
packaged Electron app. The old app entry chain still loads the original
`renderer.js`, and the original `main.js` and `renderer.js` baseline hashes are
unchanged.

## Completed This Session

- Added a project-owned renderer patch file at
  `app/main/dist/electron/patch-layer/renderer-patch.js`.
- Loaded the patch layer from `app/main/dist/electron/index.html` before the
  existing `renderer.js` script.
- Added a read-only runtime probe exposed as `window.__CFW_PATCH_LAYER__`.
- Updated `scripts/refactor/check-baseline.ps1` so future checks require the
  patch layer file and verify that it loads before `renderer.js`.
- Confirmed `main.js`, `renderer.js`, and `app/main/node_modules/` were not
  edited.

## Files Changed

- Added `app/main/dist/electron/patch-layer/renderer-patch.js`
- Updated `app/main/dist/electron/index.html`
- Updated `scripts/refactor/check-baseline.ps1`
- Updated `docs/refactor/CURRENT_STATE.md`
- Added `docs/refactor/sessions/002-patch-layer.md`

No changes were made to:

- `app/main/dist/electron/main.js`
- `app/main/dist/electron/renderer.js`
- `app/main/package.json`
- `app/main/node_modules/`

## Build and Test Path

Run the baseline check from the worktree root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Run the patch layer syntax check:

```powershell
node --check app\main\dist\electron\patch-layer\renderer-patch.js
```

Packaging remains an explicit follow-up step. Do not automatically run
`app/build_win_x64.ps1` without confirmation because it may call `npx`, install
missing global tools, prompt before deleting old output, and create packaged
output. In this PowerShell environment, direct `npm` and `npx` commands hit the
PowerShell script execution policy; prefer `npm.cmd` / `npx.cmd` or the
provided build script with explicit approval.

## Verification Results

Actual result from this session:

- Pre-change baseline check: passed.
- Post-change baseline check: passed.
- `node --check app\main\dist\electron\patch-layer\renderer-patch.js`: passed.
- Confirmed `index.html` loads `patch-layer/renderer-patch.js` before
  `renderer.js`.
- Confirmed `main.js` SHA256 still matches
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`.
- Confirmed `renderer.js` SHA256 still matches
  `7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B`.

## Next Conversation Task

Use the new patch layer as the only project-owned integration point for the next
small refactor. A good next task is to add a renderer smoke probe that can be
observed from DevTools or a small automated HTML/runtime check, still without
editing `renderer.js` or changing app behavior.

## Rollback

Rollback for this session:

```powershell
Remove-Item -Force .\app\main\dist\electron\patch-layer\renderer-patch.js
Remove-Item -Force .\docs\refactor\sessions\002-patch-layer.md
```

Then remove the patch-layer script tag from
`app/main/dist/electron/index.html`, remove the patch-layer checks from
`scripts/refactor/check-baseline.ps1`, and remove this Session 002 section from
`docs/refactor/CURRENT_STATE.md`.

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
