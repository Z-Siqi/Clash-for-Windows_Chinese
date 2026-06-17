# Session 008 - Batched Enforced Extractions

Date: 2026-06-15

## Goal

Complete a larger but still bounded batch of enforced extractions from the
packaged renderer while preserving the packaged app entry chain and avoiding
`node_modules`, push, reset, and broad bundle edits.

## Starting State

- Worktree:
  `D:\Documents\CFW_Opt\Clash-for-Windows_Chinese-worktree`
- Branch: `codex/app-baseline-opt`
- Initial `git status --short --branch` showed the already-present Session 007
  working tree changes and untracked Session 007 files.
- Initial required checks passed:
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1`
  - `node .\scripts\refactor\check-patch-layer-smoke.js`
  - `node .\scripts\refactor\check-renderer-readiness-smoke.js`
  - `node .\scripts\refactor\check-route-catalog-smoke.js`
  - `node .\scripts\refactor\check-menu-state-smoke.js`

## Extractions Completed

### 1. Settings Defaults

Old logic removed from `renderer.js`:

- inline defaults for `showNewVersionIcon`, `hideAfterStartup`,
  `randomControllerPort`, `runTimeFormat`, `trayOrders`, `hideTrayIcon`,
  `connShowProcess`, `showTrayProxyDelayIndicator`, `checkForUpdates`, and
  `disableLoadingAdsLink`;
- the inline object spread that merged those default variables into
  `mergedSettings`.

New owner:

- `app/main/dist/electron/patch-layer/packages/settings/settings-defaults.js`

New renderer call:

```js
const mergedSettings = window.__CFW_SETTINGS_DEFAULTS__.mergeSettings(settings);
```

### 2. Menu Order

Old logic removed from `renderer.js`:

- the inline `MENU_ITEM_ORDER` comparator body using `N.Z.get(...)` and
  `findIndex`;
- the direct `return r()(e.menuItems).sort(E)` getter body.

New owner:

- `app/main/dist/electron/patch-layer/packages/menu/menu-order.js`

New renderer calls:

```js
window.__CFW_MENU_ORDER__.compareMenuItems(e, t, N.Z, D.Z.MENU_ITEM_ORDER)
window.__CFW_MENU_ORDER__.sortMenuItems(r()(e.menuItems), N.Z, D.Z.MENU_ITEM_ORDER)
```

### 3. Renderer IPC Client

Old logic replaced in `renderer.js`:

- direct `y.ipcRenderer.invoke("app", "quit")`;
- direct `y.ipcRenderer.invoke("window", "minimize")`;
- direct `y.ipcRenderer.invoke("window", e)` for maximize/unmaximize;
- direct pinned titlebar `setAlwaysOnTop` invoke.

New owner:

- `app/main/dist/electron/patch-layer/packages/ipc/ipc-client.js`

New renderer calls:

```js
window.__CFW_IPC_CLIENT__.invokeApp(y.ipcRenderer, "quit")
window.__CFW_IPC_CLIENT__.invokeWindow(y.ipcRenderer, "minimize")
window.__CFW_IPC_CLIENT__.invokeWindow(y.ipcRenderer, e)
window.__CFW_IPC_CLIENT__.invokeWindow(y.ipcRenderer, "setAlwaysOnTop", this.isPinned)
```

The IPC extraction is deliberately narrow. It does not send new business IPC,
does not alter main-process behavior, and does not claim ownership of the many
remaining renderer IPC call sites.

## Main-Side Candidate Decision

`main.js` was scanned for small IPC handler/channel candidates. It contains
many `ipcMain.handle(...)` and `ipcMain.on(...)` registrations, but the stable
candidate surfaces are coupled to BrowserWindow, tray, power monitor, and app
lifecycle state. No small main-side extraction was taken in this batch.

## Verification

Commands run:

```powershell
node --check app\main\dist\electron\renderer.js
node --check app\main\dist\electron\patch-layer\packages\settings\settings-defaults.js
node --check app\main\dist\electron\patch-layer\packages\menu\menu-order.js
node --check app\main\dist\electron\patch-layer\packages\ipc\ipc-client.js
node --check scripts\refactor\check-settings-defaults-smoke.js
node --check scripts\refactor\check-menu-order-ipc-smoke.js
node --check scripts\refactor\check-route-catalog-smoke.js
node --check scripts\refactor\check-patch-layer-smoke.js
node --check scripts\refactor\check-renderer-readiness-smoke.js
node .\scripts\refactor\check-settings-defaults-smoke.js
node .\scripts\refactor\check-menu-order-ipc-smoke.js
node .\scripts\refactor\check-patch-layer-smoke.js
node .\scripts\refactor\check-renderer-readiness-smoke.js
node .\scripts\refactor\check-route-catalog-smoke.js
node .\scripts\refactor\check-menu-state-smoke.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Results:

- All syntax checks passed.
- Settings defaults smoke passed.
- Menu order and IPC smoke passed.
- Patch-layer, renderer-readiness, route-catalog, and menu-state smokes passed.
- Baseline passed and now requires the new package modules, new script order,
  new renderer delegate calls, and absence of the old inline anchors.
- Deleting any new module fails required-file checks and leaves a broken
  renderer delegate path.

## Build and Runtime

A true Electron launch or package build was not run. The safe local runtime path
remains the Node VM smoke suite because local Electron binaries are absent and
`app/build_win_x64.ps1` can call `npx`, install global packages, prompt before
deleting old output, and create packaged output.

The VM smoke path reads `window.__CFW_PATCH_LAYER__.getHealth()` and reported:

- version: `008-batched-enforced-extractions`
- route count: `9`
- matched route: `proxy`

## Hashes

- `main.js`:
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`
- `renderer.js`:
  `4A44A113D996A69C3CEE85BC7E5F89C1F698D04BB861CEA3259C2E7667AD8E62`

## Rollback

1. Restore the Session 007 renderer hash path by reverting the three narrow
   renderer edits:
   - settings `mergeSettings(...)` delegate back to the inline defaults block;
   - menu order delegates back to the inline comparator and `.sort(E)`;
   - extracted IPC delegates back to direct `y.ipcRenderer.invoke(...)`.
2. Remove the three Session 008 script tags from `index.html`.
3. Remove:
   - `patch-layer/packages/settings/settings-defaults.js`
   - `patch-layer/packages/menu/menu-order.js`
   - `patch-layer/packages/ipc/ipc-client.js`
   - `scripts/refactor/check-settings-defaults-smoke.js`
   - `scripts/refactor/check-menu-order-ipc-smoke.js`
4. Restore the Session 007 patch-layer version and smoke expectations.
5. Restore the Session 007 renderer hash in `check-baseline.ps1`:
   `86D5A17606353E6CA0485F4C41B2DB7EE1A0C321EA7313595BF6A79FDFC99ADE`.
6. Remove Session 008 baseline checks.

## Next Step

Prefer another narrow renderer-side extraction before attempting main-side work:

- continue IPC extraction with one cohesive invoke cluster;
- extend settings ownership around load/save after finding a unique call site;
- extract router fallback/normalization only if the old call site can be
  replaced without broad route runtime edits.
