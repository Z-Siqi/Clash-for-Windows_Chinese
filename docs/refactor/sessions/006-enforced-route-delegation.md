# Session 006 - Enforced Route Delegation

Date: 2026-06-15

## Goal

Correct the Session 005 route extraction so it is a real enforced extraction:
the old packaged `renderer.js` must call the extracted route catalog, and the
old inline route/menu structures must no longer be the source of truth.

## Starting State

- Worktree:
  `D:\Documents\CFW_Opt\Clash-for-Windows_Chinese-worktree`
- Branch: `codex/app-baseline-opt`
- Session 005 had added a route catalog and probes, but `renderer.js` still
  contained the old inline `menuItems` and Vue Router `routes` blocks.
- Because of that, deleting `patch-layer/` would not stop the old app from
  building or running the old route/menu behavior.

## Planning Correction

Updated planning documents now define real extraction as enforced delegation:

- `docs/refactor/DECISIONS.md`
  - added the rule that sidecar probes alone are not a completed extraction;
  - allowed narrow, anchored bundle edits when delegating old behavior.
- `docs/refactor/SESSION_TEMPLATE.md`
  - changed acceptance criteria to require old call sites to delegate to the
    extracted module.
- `docs/refactor/MODULE_MAP.md`
  - documented `patch-layer/routes/route-catalog.js` as the owner of the
    extracted route/menu metadata and builders.

## Changes Made

- Extended `app/main/dist/electron/patch-layer/routes/route-catalog.js` with:
  - `buildMenuItems(language)`
  - `buildVueRouterRoutes(moduleResolver)`
  - component/chunk ownership for the parent `/home` route and all child
    routes.
- Replaced the old `renderer.js` inline Vuex menu state:

```js
menuItems: [...]
```

with:

```js
menuItems: window.__CFW_ROUTE_CATALOG__.buildMenuItems(Lg)
```

- Replaced the old `renderer.js` inline Vue Router tree:

```js
routes: [...]
```

with:

```js
routes: window.__CFW_ROUTE_CATALOG__.buildVueRouterRoutes(o)
```

- Updated `scripts/refactor/check-baseline.ps1`:
  - expected renderer hash is now the enforced extraction hash;
  - the legacy pre-extraction hash is explicitly rejected;
  - renderer delegate calls are required;
  - old inline route/menu anchors are rejected.
- Updated `scripts/refactor/check-route-catalog-smoke.js` to verify the
  builder outputs used by the old renderer call sites.

## Main Process Scope

`app/main/dist/electron/main.js` was inspected for route/menu ownership. It only
owns the BrowserWindow and `index.html` loading path for this area, so it was
not changed. There was no extracted route/menu logic in `main.js` to remove.

## Verification

Commands run:

```powershell
rg -n "/home|router|menuItems|BrowserWindow|loadURL|index.html|renderer.js" app\main\dist\electron\main.js
node --check app\main\dist\electron\renderer.js
node --check app\main\dist\electron\patch-layer\routes\route-catalog.js
node --check scripts\refactor\check-route-catalog-smoke.js
node .\scripts\refactor\check-route-catalog-smoke.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Results:

- `main.js` contains no route/menu ownership for this extracted behavior.
- `renderer.js` syntax passed.
- `route-catalog.js` syntax passed.
- Route catalog smoke passed.
- Runtime health version is now `006-enforced-route-delegation`.
- Baseline passed and now enforces:
  - route catalog builder API presence;
  - renderer delegation to route catalog;
  - absence of old inline route/menu anchors;
  - new enforced renderer hash.

Hashes:

- `main.js`:
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`
- `renderer.js`:
  `E0A54DC7914C441880BD12B84A91F91979CA128CED9886C4EFDCCBA545BE0E5C`

## Rollback

Rollback requires restoring the two narrow `renderer.js` replacements:

- replace `window.__CFW_ROUTE_CATALOG__.buildMenuItems(Lg)` with the previous
  inline seven-item menu array;
- replace `window.__CFW_ROUTE_CATALOG__.buildVueRouterRoutes(o)` with the
  previous inline Vue Router route tree.

Then restore the previous route catalog without builder APIs and restore the
previous baseline expected renderer hash.
