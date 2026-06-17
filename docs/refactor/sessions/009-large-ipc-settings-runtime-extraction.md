# Session 009 - Large IPC Cluster Extraction

Date: 2026-06-16

## Goal

Complete a larger autonomous enforced extraction batch by moving five cohesive
renderer IPC clusters from direct packaged `renderer.js` invokes into
project-owned IPC package modules.

## Starting State

- Worktree:
  `D:\Documents\CFW_Opt\Clash-for-Windows_Chinese-worktree`
- Branch: `codex/app-baseline-opt`
- Initial `git status --short --branch` showed existing Session 007/008
  working-tree changes and untracked package/session/smoke files.
- Initial required baseline and smoke commands passed:
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1`
  - `node .\scripts\refactor\check-patch-layer-smoke.js`
  - `node .\scripts\refactor\check-renderer-readiness-smoke.js`
  - `node .\scripts\refactor\check-route-catalog-smoke.js`
  - `node .\scripts\refactor\check-menu-state-smoke.js`
  - `node .\scripts\refactor\check-settings-defaults-smoke.js`
  - `node .\scripts\refactor\check-menu-order-ipc-smoke.js`

## Extractions Completed

### 1. App IPC

Old direct renderer logic replaced:

- `ipcRenderer.invoke("app", "getPath", ...)`
- `ipcRenderer.invoke("app", "getVersion")`
- `ipcRenderer.invoke("app", "getName")`
- `ipcRenderer.invoke("app", "getAppPath")`
- `ipcRenderer.invoke("app", "isPackaged")`
- `ipcRenderer.invoke("app", "setLoginItemSettings", ...)`
- `ipcRenderer.invoke("app", "relaunch")`
- `ipcRenderer.invoke("app", "exit", 0)`

New owner:

- `app/main/dist/electron/patch-layer/packages/ipc/app-ipc.js`

Representative new renderer calls:

```js
window.__CFW_APP_IPC__.getPath(y.ipcRenderer, "home")
window.__CFW_APP_IPC__.setLoginItemSettings(u.ipcRenderer, { openAtLogin: t })
window.__CFW_APP_IPC__.relaunch(u.ipcRenderer)
```

### 2. Window and Window-Control IPC

Old direct renderer logic replaced:

- `ipcRenderer.invoke("window", "setFullScreen", ...)`
- `ipcRenderer.invoke("window", "isMaximized")`
- `ipcRenderer.invoke("window", "isVisible")`
- `ipcRenderer.invoke("window", "setAlwaysOnTop", ...)`
- `ipcRenderer.invoke("window", "reload")`
- `ipcRenderer.invoke("window", "close")`
- `ipcRenderer.invoke("window-control", "show")`
- `ipcRenderer.invoke("window-control", "show-or-hide")`

New owner:

- `app/main/dist/electron/patch-layer/packages/ipc/window-ipc.js`

Representative new renderer calls:

```js
window.__CFW_WINDOW_IPC__.isVisible(y.ipcRenderer)
window.__CFW_WINDOW_IPC__.reload(require("electron").ipcRenderer)
window.__CFW_WINDOW_IPC__.showOrHide(y.ipcRenderer)
```

### 3. Dialog IPC

Old direct renderer logic replaced:

- `ipcRenderer.invoke("dialog", "showMessageBox", ...)`
- `ipcRenderer.invoke("dialog", "showOpenDialogSync", ...)`

New owner:

- `app/main/dist/electron/patch-layer/packages/ipc/dialog-ipc.js`

Representative new renderer call:

```js
window.__CFW_DIALOG_IPC__.showOpenDialogSync(W.ipcRenderer, {
    properties: [i ? "openFile" : "openDirectory"]
})
```

### 4. Global Shortcut IPC

Old direct renderer logic replaced:

- `ipcRenderer.invoke("globalShortcut", "unregister", t)`
- `ipcRenderer.invoke("globalShortcut", "register", e)`
- `ipcRenderer.invoke("globalShortcut", "isRegistered", e)`

New owner:

- `app/main/dist/electron/patch-layer/packages/ipc/global-shortcut-ipc.js`

Representative new renderer call:

```js
window.__CFW_GLOBAL_SHORTCUT_IPC__.register(y.ipcRenderer, e)
```

### 5. Runtime IPC

Old direct renderer logic replaced:

- `ipcRenderer.invoke("nativeTheme", "shouldUseDarkColors")`
- `ipcRenderer.invoke("powerSaveBlocker", "start", "prevent-app-suspension")`
- `ipcRenderer.invoke("powerSaveBlocker", "stop", this.powersaveBlockerID)`
- `ipcRenderer.invoke("webContent", "toggleDevTools")`

New owner:

- `app/main/dist/electron/patch-layer/packages/ipc/runtime-ipc.js`

Representative new renderer calls:

```js
window.__CFW_RUNTIME_IPC__.shouldUseDarkColors(y.ipcRenderer)
window.__CFW_RUNTIME_IPC__.startPowerSaveBlocker(h.ipcRenderer, "prevent-app-suspension")
window.__CFW_RUNTIME_IPC__.toggleDevTools(y.ipcRenderer)
```

## Main-Side Candidate Decision

`main.js` was scanned for IPC handler/channel candidates. It was left unchanged
because the small-looking handlers still sit inside a broad BrowserWindow,
tray, dock, global shortcut, native theme, and power lifecycle closure. A pure
metadata helper may be possible later, but this session kept `main.js` hash
stable.

## Verification

Commands run:

```powershell
node --check app\main\dist\electron\renderer.js
node --check app\main\dist\electron\patch-layer\packages\ipc\ipc-client.js
node --check app\main\dist\electron\patch-layer\packages\ipc\app-ipc.js
node --check app\main\dist\electron\patch-layer\packages\ipc\window-ipc.js
node --check app\main\dist\electron\patch-layer\packages\ipc\dialog-ipc.js
node --check app\main\dist\electron\patch-layer\packages\ipc\global-shortcut-ipc.js
node --check app\main\dist\electron\patch-layer\packages\ipc\runtime-ipc.js
node --check scripts\refactor\check-ipc-clusters-smoke.js
node --check scripts\refactor\check-route-catalog-smoke.js
node --check scripts\refactor\check-patch-layer-smoke.js
node --check scripts\refactor\check-renderer-readiness-smoke.js
node --check scripts\refactor\check-menu-order-ipc-smoke.js
node .\scripts\refactor\check-patch-layer-smoke.js
node .\scripts\refactor\check-renderer-readiness-smoke.js
node .\scripts\refactor\check-route-catalog-smoke.js
node .\scripts\refactor\check-menu-state-smoke.js
node .\scripts\refactor\check-settings-defaults-smoke.js
node .\scripts\refactor\check-menu-order-ipc-smoke.js
node .\scripts\refactor\check-ipc-clusters-smoke.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Results:

- All syntax checks passed.
- Patch-layer, renderer-readiness, route-catalog, menu-state, settings-defaults,
  menu-order/IPC, and IPC-clusters smokes passed.
- IPC clusters smoke recorded ten representative calls across app, window,
  window-control, dialog, globalShortcut, nativeTheme, powerSaveBlocker, and
  webContent channels.
- Baseline passed and now enforces the five new package modules, script order,
  renderer delegates, old direct invoke anchor removal, and Session 009
  renderer hash.

## Build and Runtime

A true Electron launch or package build was not run.

Safe local probes found:

- `app/main/node_modules/electron`: absent.
- `app/main/node_modules/.bin/electron.cmd`: absent.
- `app/main/node_modules/electron-packager`: absent.
- `app/main/node_modules/asar`: absent.
- `npm.cmd --prefix app\main run`: no project scripts were available.
- `app/build_win_x64.ps1` still contains `npx`, possible global installs,
  `Read-Host` prompts, and output deletion paths.

The runtime-equivalent verification remains the dependency-free Node VM smoke
suite. It reads `window.__CFW_PATCH_LAYER__.getHealth()` and reported version
`009-large-ipc-settings-runtime-extraction`.

## Hashes

- `main.js`:
  `AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F`
- `renderer.js`:
  `9CAF1DE5C36964F1147F07A30B8A3585318CD1CD44DC4BC7C96E984F7F073523`

## Rollback

1. Restore the replaced direct `renderer.js` IPC invoke expressions for the
   extracted channel clusters.
2. Remove the five Session 009 IPC package script tags from `index.html`.
3. Remove:
   - `patch-layer/packages/ipc/app-ipc.js`
   - `patch-layer/packages/ipc/window-ipc.js`
   - `patch-layer/packages/ipc/dialog-ipc.js`
   - `patch-layer/packages/ipc/global-shortcut-ipc.js`
   - `patch-layer/packages/ipc/runtime-ipc.js`
   - `scripts/refactor/check-ipc-clusters-smoke.js`
4. Restore Session 008 version strings and smoke expectations.
5. Restore the Session 008 renderer hash
   `4A44A113D996A69C3CEE85BC7E5F89C1F698D04BB861CEA3259C2E7667AD8E62`
   in `check-baseline.ps1`.
6. Remove Session 009 checks from `check-baseline.ps1` and
   `check-route-catalog-smoke.js`.

## Skipped Candidates

- `main.js` handler extraction: skipped because current candidates are coupled
  to live BrowserWindow/tray/nativeTheme/globalShortcut/power lifecycle state.
- Build/package verification: skipped because local runtime/package tooling is
  absent and the packaging script can install globally, prompt, and delete
  output.
- Settings load/save extraction: skipped to keep this batch within the IPC
  priority lane after five real extractions were completed.

## Next Step

Continue with one of:

- another narrow IPC batch for tray/download/wlan channels;
- a settings load/path helper around `cfw-settings.yaml`;
- a pure main-side IPC channel metadata helper if it can be extracted without
  moving handler lifecycle logic.
