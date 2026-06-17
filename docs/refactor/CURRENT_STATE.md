# Current Refactor State

## Session 009 - Large IPC Cluster Extraction

Date: 2026-06-16

This session completed five additional enforced extractions from packaged
`renderer.js` into project-owned IPC package modules:

- app IPC helpers in `patch-layer/packages/ipc/app-ipc.js`;
- window and window-control IPC helpers in
  `patch-layer/packages/ipc/window-ipc.js`;
- dialog IPC helpers in `patch-layer/packages/ipc/dialog-ipc.js`;
- global shortcut IPC helpers in
  `patch-layer/packages/ipc/global-shortcut-ipc.js`;
- runtime IPC helpers for `nativeTheme`, `powerSaveBlocker`, and `webContent`
  in `patch-layer/packages/ipc/runtime-ipc.js`.

The old packaged renderer no longer directly invokes the extracted
`app`, `window`, `window-control`, `dialog`, `globalShortcut`, `nativeTheme`,
`powerSaveBlocker`, or `webContent` IPC channels. Those call sites now delegate
through the new package modules, while the existing narrow titlebar
`app quit`, `window minimize`, `window maximize/unmaximize`, and pin-window
delegates from Session 008 remain routed through `__CFW_IPC_CLIENT__`.

`main.js` was inspected again for a small main-side helper candidate and left
unchanged because the handler bodies remain coupled to BrowserWindow, tray,
dock, global shortcut, native theme, and power lifecycle state. No files under
`app/main/node_modules/` were changed.

## Completed This Session

- Added:
  - `app/main/dist/electron/patch-layer/packages/ipc/app-ipc.js`
  - `app/main/dist/electron/patch-layer/packages/ipc/window-ipc.js`
  - `app/main/dist/electron/patch-layer/packages/ipc/dialog-ipc.js`
  - `app/main/dist/electron/patch-layer/packages/ipc/global-shortcut-ipc.js`
  - `app/main/dist/electron/patch-layer/packages/ipc/runtime-ipc.js`
  - `scripts/refactor/check-ipc-clusters-smoke.js`
- Updated `index.html` to load the five new IPC package modules after
  `ipc-client.js` and before the runtime probes.
- Updated `renderer-patch.js` and the IPC client version to
  `009-large-ipc-settings-runtime-extraction`.
- Replaced direct renderer IPC invokes for the extracted channel clusters with
  package delegates.
- Extended `scripts/refactor/check-route-catalog-smoke.js` so the VM load chain
  includes the new IPC package modules.
- Extended `scripts/refactor/check-baseline.ps1` so it now:
  - requires the five new IPC modules and the new smoke script;
  - verifies `index.html` loads the new modules in order;
  - verifies renderer delegate calls to the new IPC package modules;
  - verifies old direct invoke anchors for the extracted channels are gone;
  - rejects the Session 008 renderer hash as incomplete for this batch;
  - accepts the new Session 009 renderer hash.

## Files Changed

- Updated `app/main/dist/electron/index.html`
- Updated `app/main/dist/electron/renderer.js`
- Updated `app/main/dist/electron/patch-layer/renderer-patch.js`
- Updated `app/main/dist/electron/patch-layer/packages/ipc/ipc-client.js`
- Added `app/main/dist/electron/patch-layer/packages/ipc/app-ipc.js`
- Added `app/main/dist/electron/patch-layer/packages/ipc/window-ipc.js`
- Added `app/main/dist/electron/patch-layer/packages/ipc/dialog-ipc.js`
- Added `app/main/dist/electron/patch-layer/packages/ipc/global-shortcut-ipc.js`
- Added `app/main/dist/electron/patch-layer/packages/ipc/runtime-ipc.js`
- Updated `scripts/refactor/check-baseline.ps1`
- Updated `scripts/refactor/check-patch-layer-smoke.js`
- Updated `scripts/refactor/check-renderer-readiness-smoke.js`
- Updated `scripts/refactor/check-route-catalog-smoke.js`
- Updated `scripts/refactor/check-menu-order-ipc-smoke.js`
- Added `scripts/refactor/check-ipc-clusters-smoke.js`
- Updated `docs/refactor/CURRENT_STATE.md`
- Updated `docs/refactor/MODULE_MAP.md`
- Added `docs/refactor/sessions/009-large-ipc-settings-runtime-extraction.md`

No changes were made to:

- `app/main/dist/electron/main.js`
- `app/main/node_modules/`

## Enforced Extraction Boundaries

App IPC:

- Old direct renderer calls to `ipcRenderer.invoke("app", ...)` for
  `getPath`, `getVersion`, `getName`, `getAppPath`, `isPackaged`,
  `setLoginItemSettings`, `relaunch`, and `exit` were replaced.
- `app-ipc.js` now owns those renderer-side app invoke helpers.

Window IPC:

- Old direct renderer calls to `ipcRenderer.invoke("window", ...)` and
  `ipcRenderer.invoke("window-control", ...)` for visibility, reload, close,
  fullscreen, always-on-top, and show/show-or-hide paths were replaced.
- `window-ipc.js` now owns those renderer-side window and window-control
  helpers.

Dialog IPC:

- Old direct renderer calls to `ipcRenderer.invoke("dialog", ...)` for
  `showMessageBox` and `showOpenDialogSync` were replaced.
- `dialog-ipc.js` now owns those renderer-side dialog helpers.

Global shortcut IPC:

- Old direct renderer calls to `ipcRenderer.invoke("globalShortcut", ...)` for
  register, unregister, and isRegistered were replaced.
- `global-shortcut-ipc.js` now owns those renderer-side shortcut helpers.

Runtime IPC:

- Old direct renderer calls to `ipcRenderer.invoke("nativeTheme", ...)`,
  `ipcRenderer.invoke("powerSaveBlocker", ...)`, and
  `ipcRenderer.invoke("webContent", ...)` were replaced.
- `runtime-ipc.js` now owns those renderer-side runtime helpers.

## Verification Results

Actual result from this session:

- Initial required git status, baseline, and smoke commands passed before
  edits.
- `node --check` passed for:
  - `app/main/dist/electron/renderer.js`
  - `app/main/dist/electron/patch-layer/packages/ipc/ipc-client.js`
  - all five new IPC package modules
  - changed and new smoke scripts.
- `node .\scripts\refactor\check-patch-layer-smoke.js`: passed with version
  `009-large-ipc-settings-runtime-extraction`.
- `node .\scripts\refactor\check-renderer-readiness-smoke.js`: passed with
  version `009-large-ipc-settings-runtime-extraction`.
- `node .\scripts\refactor\check-route-catalog-smoke.js`: passed with version
  `009-large-ipc-settings-runtime-extraction`.
- `node .\scripts\refactor\check-menu-state-smoke.js`: passed.
- `node .\scripts\refactor\check-settings-defaults-smoke.js`: passed.
- `node .\scripts\refactor\check-menu-order-ipc-smoke.js`: passed.
- `node .\scripts\refactor\check-ipc-clusters-smoke.js`: passed and recorded
  ten representative calls across the extracted IPC clusters.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1`:
  passed.
- Baseline now verifies that deleting any new IPC module or the IPC cluster
  smoke breaks required-file checks, script-order checks, renderer delegate
  checks, and/or runtime smoke coverage.
- A true Electron launch or package build was not run. Local Electron,
  electron-packager, and asar packages are absent, and `app/build_win_x64.ps1`
  still can use `npx`, install global tools, prompt before deleting output,
  and create packaged output.
- `window.__CFW_PATCH_LAYER__.getHealth()` was read through the Node VM smoke
  path, reporting health version
  `009-large-ipc-settings-runtime-extraction`.
- `main.js` SHA256 remains
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`.
- `renderer.js` SHA256 is now
  `9CAF1DE5C36964F1147F07A30B8A3585318CD1CD44DC4BC7C96E984F7F073523`.

## Rollback

Rollback for this session:

1. Restore direct `renderer.js` IPC invoke expressions for the extracted
   `app`, `window`, `window-control`, `dialog`, `globalShortcut`,
   `nativeTheme`, `powerSaveBlocker`, and `webContent` calls.
2. Remove the five Session 009 IPC package script tags from `index.html`.
3. Remove:
   - `patch-layer/packages/ipc/app-ipc.js`
   - `patch-layer/packages/ipc/window-ipc.js`
   - `patch-layer/packages/ipc/dialog-ipc.js`
   - `patch-layer/packages/ipc/global-shortcut-ipc.js`
   - `patch-layer/packages/ipc/runtime-ipc.js`
   - `scripts/refactor/check-ipc-clusters-smoke.js`
4. Restore the Session 008 patch-layer and IPC client version expectations.
5. Restore the Session 008 renderer hash
   `4A44A113D996A69C3CEE85BC7E5F89C1F698D04BB861CEA3259C2E7667AD8E62`.
6. Remove Session 009 checks from `check-baseline.ps1` and
   `check-route-catalog-smoke.js`.

## Next Conversation Task

Good next candidates:

- continue IPC extraction for adjacent non-core channels such as
  `tray-create-destroy`, `tray-proxies-style`, `tray-proxies-icon`,
  `wlan-status-wanted`, and `start-download` if their call sites remain narrow;
- extract a settings load/path helper around `cfw-settings.yaml` now that
  defaults and merge logic are already package-owned;
- revisit main-side extraction only for a pure channel metadata/catalog helper,
  not for handler bodies coupled to BrowserWindow lifecycle.

## Session 008 - Batched Enforced Extractions

Date: 2026-06-15

This session completed three small enforced extractions from the packaged
renderer into project-owned package modules:

- settings default/merge normalization into
  `patch-layer/packages/settings/settings-defaults.js`;
- menu item order comparison/sorting into
  `patch-layer/packages/menu/menu-order.js`;
- a renderer IPC channel/client helper into
  `patch-layer/packages/ipc/ipc-client.js`.

The old packaged `renderer.js` now calls:

- `window.__CFW_SETTINGS_DEFAULTS__.mergeSettings(settings)`;
- `window.__CFW_MENU_ORDER__.compareMenuItems(e, t, N.Z, D.Z.MENU_ITEM_ORDER)`;
- `window.__CFW_MENU_ORDER__.sortMenuItems(r()(e.menuItems), N.Z, D.Z.MENU_ITEM_ORDER)`;
- `window.__CFW_IPC_CLIENT__.invokeApp(y.ipcRenderer, "quit")`;
- `window.__CFW_IPC_CLIENT__.invokeWindow(...)` for the extracted minimize,
  maximize/unmaximize, and pin-window call sites.

`main.js` was inspected for a small main-side IPC helper candidate and left
unchanged because its handlers are broad, minified, and coupled to
BrowserWindow/tray lifecycle state. No files under `app/main/node_modules/`
were changed.

## Completed This Session

- Added `app/main/dist/electron/patch-layer/packages/settings/settings-defaults.js`.
- Added `app/main/dist/electron/patch-layer/packages/menu/menu-order.js`.
- Added `app/main/dist/electron/patch-layer/packages/ipc/ipc-client.js`.
- Updated `index.html` to load the three new package modules after menu state
  and before route readiness probes.
- Updated `renderer-patch.js` health version to
  `008-batched-enforced-extractions`.
- Replaced the old inline settings default block with a settings package merge
  delegate.
- Replaced the old inline menu order comparator and `menuItemsWithOrder` sort
  call with menu order package delegates.
- Replaced direct app/window IPC invokes in the titlebar control methods with
  IPC client package delegates.
- Added:
  - `scripts/refactor/check-settings-defaults-smoke.js`
  - `scripts/refactor/check-menu-order-ipc-smoke.js`
- Extended `scripts/refactor/check-baseline.ps1` so it now:
  - requires the three new package modules and two smoke scripts;
  - verifies `index.html` loads the new modules in the expected order;
  - verifies `renderer.js` delegates settings merge, menu order, and extracted
    IPC invokes;
  - verifies old inline settings/menu-order/direct-IPC anchors are gone;
  - rejects the Session 007 renderer hash as incomplete for this batch;
  - accepts the new Session 008 renderer hash.

## Files Changed

- Updated `app/main/dist/electron/index.html`
- Updated `app/main/dist/electron/renderer.js`
- Updated `app/main/dist/electron/patch-layer/renderer-patch.js`
- Added `app/main/dist/electron/patch-layer/packages/settings/settings-defaults.js`
- Added `app/main/dist/electron/patch-layer/packages/menu/menu-order.js`
- Added `app/main/dist/electron/patch-layer/packages/ipc/ipc-client.js`
- Updated `scripts/refactor/check-baseline.ps1`
- Updated `scripts/refactor/check-patch-layer-smoke.js`
- Updated `scripts/refactor/check-renderer-readiness-smoke.js`
- Updated `scripts/refactor/check-route-catalog-smoke.js`
- Added `scripts/refactor/check-settings-defaults-smoke.js`
- Added `scripts/refactor/check-menu-order-ipc-smoke.js`
- Updated `docs/refactor/CURRENT_STATE.md`
- Updated `docs/refactor/MODULE_MAP.md`
- Added `docs/refactor/sessions/008-batched-enforced-extractions.md`

No changes were made to:

- `app/main/dist/electron/main.js`
- `app/main/node_modules/`

## Enforced Extraction Boundaries

Settings defaults:

- Old inline renderer default variables for `showNewVersionIcon`,
  `hideAfterStartup`, `randomControllerPort`, `runTimeFormat`, `trayOrders`,
  `hideTrayIcon`, `connShowProcess`, `showTrayProxyDelayIndicator`,
  `checkForUpdates`, and `disableLoadingAdsLink` were removed.
- `settings-defaults.js` now owns those defaults and returns the merged object
  consumed by the old settings load path.

Menu order:

- The old comparator body that read `N.Z.get(D.Z.MENU_ITEM_ORDER)` and used
  inline `findIndex` logic was removed.
- The old `return r()(e.menuItems).sort(E)` getter body was replaced with a
  `sortMenuItems(...)` delegate.

Renderer IPC:

- The titlebar control methods no longer directly invoke the extracted app and
  window IPC calls.
- The wider renderer still owns many IPC call sites; this session only moved
  the small app/window titlebar cluster.

## Verification Results

Actual result from this session:

- Initial required git status, baseline, and smoke commands passed before
  edits.
- `node --check` passed for:
  - `app/main/dist/electron/renderer.js`
  - `app/main/dist/electron/patch-layer/packages/settings/settings-defaults.js`
  - `app/main/dist/electron/patch-layer/packages/menu/menu-order.js`
  - `app/main/dist/electron/patch-layer/packages/ipc/ipc-client.js`
  - changed and new smoke scripts.
- `node .\scripts\refactor\check-patch-layer-smoke.js`: passed with version
  `008-batched-enforced-extractions`.
- `node .\scripts\refactor\check-renderer-readiness-smoke.js`: passed with
  version `008-batched-enforced-extractions`.
- `node .\scripts\refactor\check-route-catalog-smoke.js`: passed with version
  `008-batched-enforced-extractions`.
- `node .\scripts\refactor\check-menu-state-smoke.js`: passed.
- `node .\scripts\refactor\check-settings-defaults-smoke.js`: passed.
- `node .\scripts\refactor\check-menu-order-ipc-smoke.js`: passed.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1`:
  passed.
- Baseline now verifies that deleting any new module breaks required-file
  checks, script-order checks, and/or renderer delegate checks.
- A true Electron launch or package build was not run because local Electron
  runtime/package tooling is still absent and `app/build_win_x64.ps1` can use
  `npx`, install global tools, prompt before deleting output, and create
  packaged output.
- `window.__CFW_PATCH_LAYER__.getHealth()` was read through the Node VM smoke
  path, reporting health version `008-batched-enforced-extractions`.
- `main.js` SHA256 remains
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`.
- `renderer.js` SHA256 is now
  `4A44A113D996A69C3CEE85BC7E5F89C1F698D04BB861CEA3259C2E7667AD8E62`.

## Rollback

Rollback for this session:

1. Restore the Session 007 `renderer.js` anchors:
   - replace `window.__CFW_SETTINGS_DEFAULTS__.mergeSettings(settings)` with
     the previous inline default/merge block;
   - restore the inline `MENU_ITEM_ORDER` comparator and
     `return r()(e.menuItems).sort(E)`;
   - restore the direct `y.ipcRenderer.invoke(...)` calls for the extracted
     titlebar app/window methods.
2. Remove the three new package script tags from `index.html`.
3. Remove:
   - `patch-layer/packages/settings/settings-defaults.js`
   - `patch-layer/packages/menu/menu-order.js`
   - `patch-layer/packages/ipc/ipc-client.js`
   - `scripts/refactor/check-settings-defaults-smoke.js`
   - `scripts/refactor/check-menu-order-ipc-smoke.js`
4. Restore Session 007 patch-layer version expectations and renderer hash
   `86D5A17606353E6CA0485F4C41B2DB7EE1A0C321EA7313595BF6A79FDFC99ADE`.
5. Remove Session 008 checks from `check-baseline.ps1`.

## Next Conversation Task

Continue with another small enforced extraction. Good candidates:

- a second renderer IPC cluster, preferably a cohesive `window-control` or
  `app/getPath` helper cluster;
- a settings load/save helper that is adjacent to the defaults extracted here;
- a router fallback/normalize helper if a unique renderer call site is found.

## Session 007 - Menu Current Route Extraction

Date: 2026-06-15

This session added the package namespace for continued enforced extraction and
moved the renderer's initial `currentRoutePath` fallback rule into a
project-owned menu state package. The old packaged `renderer.js` now calls
`window.__CFW_MENU_STATE__.getInitialCurrentRoutePath(N.Z, D.Z.CURRENT_ROUTE_PATH)`
instead of owning the inline
`N.Z.get(D.Z.CURRENT_ROUTE_PATH) || "/home/general"` expression.

`main.js` was left unchanged. No files under `app/main/node_modules/` were
changed.

## Completed This Session

- Added package namespace directories under
  `app/main/dist/electron/patch-layer/packages/`:
  - `packages/`
  - `packages/router/`
  - `packages/menu/`
  - `packages/settings/`
  - `packages/ipc/`
  - `packages/runtime/`
  - `packages/main/`
- Added `app/main/dist/electron/patch-layer/packages/menu/menu-state.js`.
- Updated `index.html` to load
  `patch-layer/packages/menu/menu-state.js` after the route catalog and before
  route readiness probes.
- Replaced the old inline `renderer.js` current route initializer with:
  - `window.__CFW_MENU_STATE__.getInitialCurrentRoutePath(N.Z, D.Z.CURRENT_ROUTE_PATH)`
- Updated `renderer-patch.js` health version to
  `007-menu-current-route-extraction`.
- Added `scripts/refactor/check-menu-state-smoke.js`.
- Extended `scripts/refactor/check-baseline.ps1` so it now:
  - checks the new package directories;
  - requires the menu state module and smoke script;
  - verifies `index.html` loads the menu state module in order;
  - verifies `renderer.js` delegates current-route initialization to the menu
    state package;
  - verifies the old inline current-route fallback anchor is gone;
  - rejects the Session 006 renderer hash as incomplete for this extraction;
  - accepts the new Session 007 renderer hash.

## Files Changed

- Updated `app/main/dist/electron/index.html`
- Updated `app/main/dist/electron/renderer.js`
- Updated `app/main/dist/electron/patch-layer/renderer-patch.js`
- Added `app/main/dist/electron/patch-layer/packages/.gitkeep`
- Added `app/main/dist/electron/patch-layer/packages/router/.gitkeep`
- Added `app/main/dist/electron/patch-layer/packages/menu/menu-state.js`
- Added `app/main/dist/electron/patch-layer/packages/settings/.gitkeep`
- Added `app/main/dist/electron/patch-layer/packages/ipc/.gitkeep`
- Added `app/main/dist/electron/patch-layer/packages/runtime/.gitkeep`
- Added `app/main/dist/electron/patch-layer/packages/main/.gitkeep`
- Updated `scripts/refactor/check-baseline.ps1`
- Updated `scripts/refactor/check-patch-layer-smoke.js`
- Updated `scripts/refactor/check-renderer-readiness-smoke.js`
- Updated `scripts/refactor/check-route-catalog-smoke.js`
- Added `scripts/refactor/check-menu-state-smoke.js`
- Updated `docs/refactor/CURRENT_STATE.md`
- Updated `docs/refactor/MODULE_MAP.md`
- Added `docs/refactor/sessions/007-menu-current-route-extraction.md`

No changes were made to:

- `app/main/dist/electron/main.js`
- `app/main/node_modules/`

## Enforced Extraction Boundary

The extracted menu state package now owns:

- the persisted current route storage key metadata;
- reading the old storage adapter through `storage.get(key)`;
- the fallback route path `/home/general`, sourced from the route catalog when
  available;
- the `window.__CFW_MENU_STATE__` renderer API used by the old bundle.

The old renderer still owns the wider Vuex app state object and route mutation
flow. This session only delegates initial `currentRoutePath` resolution.

## Verification Results

Actual result from this session:

- Initial required baseline and smoke commands passed before edits.
- `renderer.js` syntax check passed after the narrow bundle edit.
- New/changed patch-layer and smoke scripts passed syntax checks.
- `node .\scripts\refactor\check-patch-layer-smoke.js`: passed with version
  `007-menu-current-route-extraction`.
- `node .\scripts\refactor\check-renderer-readiness-smoke.js`: passed with
  version `007-menu-current-route-extraction`.
- `node .\scripts\refactor\check-route-catalog-smoke.js`: passed with version
  `007-menu-current-route-extraction`.
- `node .\scripts\refactor\check-menu-state-smoke.js`: passed with fallback
  path `/home/general` and stored route `/home/proxy`.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1`:
  passed.
- Baseline now verifies that:
  - package directories exist;
  - menu state module and smoke script exist;
  - `index.html` loads the menu state package in the expected order;
  - `renderer.js` delegates current-route initialization to menu state;
  - the old inline current-route fallback expression is absent;
  - the Session 006 renderer hash is no longer accepted for this step.
- A true Electron launch or package build was not run because local/global
  Electron packaging tools are absent and the packaging script may install
  global tools, prompt before deleting output, and create packaged output.
- `window.__CFW_PATCH_LAYER__.getHealth()` was read through the Node VM smoke
  path, which reported health version `007-menu-current-route-extraction`.
- `main.js` SHA256 remains
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`.
- `renderer.js` SHA256 is now
  `86D5A17606353E6CA0485F4C41B2DB7EE1A0C321EA7313595BF6A79FDFC99ADE`.

## Rollback

Rollback for this session:

1. Restore the previous `renderer.js` current-route initializer:
   - replace
     `window.__CFW_MENU_STATE__.getInitialCurrentRoutePath(N.Z, D.Z.CURRENT_ROUTE_PATH)`
     with `N.Z.get(D.Z.CURRENT_ROUTE_PATH) || "/home/general"`.
2. Remove the `patch-layer/packages/menu/menu-state.js` script tag from
   `index.html`.
3. Remove `scripts/refactor/check-menu-state-smoke.js` and the Session 007
   package/menu-state checks from `check-baseline.ps1`.
4. Restore the Session 006 patch-layer version and renderer hash
   `E0A54DC7914C441880BD12B84A91F91979CA128CED9886C4EFDCCBA545BE0E5C`.

## Next Conversation Task

Continue with another small enforced extraction using the new package
namespace. Prefer one of:

- settings default/merge logic into `packages/settings/`;
- IPC channel catalog/client helper into `packages/ipc/`;
- a slightly larger menu/order helper into `packages/menu/`.

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
