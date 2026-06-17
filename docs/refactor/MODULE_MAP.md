# Module Map

## Workspace Shape

Root: `D:\Documents\CFW_Opt`

Important entries:

- `app/`: extracted, packaged, localized Clash for Windows application.
- `app/main/`: Electron application package used by `electron-packager`.
- `app/main/dist/electron/`: packaged runtime JavaScript, HTML, static assets,
  worker file, and webpack chunks.
- `app/main/node_modules/`: runtime dependencies. Do not edit directly.
- `app/clash_core/`: platform-specific Clash core binaries and static resource
  bundles copied during packaging.
- `app/build_*.ps1`: platform-specific packager scripts.
- `app/build_default.bat`: Windows helper that runs `build_win_x64.ps1`.

## Electron Entry Chain

1. `app/main/package.json`
   - `main` is `./dist/electron/main.js`.
2. `app/main/dist/electron/main.js`
   - Creates the Electron `BrowserWindow`.
   - Sets `global.__static` to `dist/electron/static`.
   - Builds `file://${__dirname}/index.html`.
   - Calls `BrowserWindow.loadURL(...)` with a `ClashforWindows/<version>`
     user agent.
3. `app/main/dist/electron/index.html`
   - Contains `<div id=app></div>`.
   - Loads `<script defer=defer src=renderer.js></script>`.
4. `app/main/dist/electron/renderer.js`
   - Large webpack renderer bundle.
   - No source map is present in the current extracted app.
   - Enforced extraction sessions may make narrow, anchored edits that delegate
     specific old behaviors to project-owned modules loaded before
     `renderer.js`.

## Project-Owned Patch Layer

`app/main/dist/electron/patch-layer/` contains project-owned modules loaded by
`index.html` before `renderer.js`.

Package namespace added for future extracted ownership:

- `patch-layer/packages/`
  - Shared namespace for project-owned modules that replace old bundled logic.
- `patch-layer/packages/router/`
  - Reserved for router and navigation runtime ownership.
- `patch-layer/packages/menu/`
  - Owns menu-related state helpers extracted from `renderer.js`.
  - `menu-state.js` owns initial `currentRoutePath` resolution from persisted
    storage with the `/home/general` fallback.
  - `menu-order.js` owns menu item order lookup, comparison, and sorted clone
    construction for the `menuItemsWithOrder` getter.
- `patch-layer/packages/settings/`
  - Owns settings default and merge extraction.
  - `settings-defaults.js` owns the defaults for settings loaded from
    `cfw-settings.yaml`, including `showNewVersionIcon`,
    `hideAfterStartup`, `randomControllerPort`, `runTimeFormat`,
    `trayOrders`, `hideTrayIcon`, `connShowProcess`,
    `showTrayProxyDelayIndicator`, `checkForUpdates`, and
    `disableLoadingAdsLink`.
- `patch-layer/packages/ipc/`
  - Owns renderer IPC channel catalog/client extraction.
  - `ipc-client.js` owns the renderer-side channel catalog and helper methods
    used by extracted `app` and `window` invoke call sites.
  - `app-ipc.js` owns renderer-side app invoke helpers for extracted app
    methods such as `getPath`, `getVersion`, `getName`, `getAppPath`,
    `isPackaged`, `setLoginItemSettings`, `relaunch`, and `exit`.
  - `window-ipc.js` owns renderer-side window and window-control invoke helpers
    for visibility, reload, close, fullscreen, always-on-top, show, and
    show-or-hide paths.
  - `dialog-ipc.js` owns renderer-side dialog invoke helpers for
    `showMessageBox` and `showOpenDialogSync`.
  - `global-shortcut-ipc.js` owns renderer-side global shortcut registration,
    unregistration, and registration-state helpers.
  - `runtime-ipc.js` owns renderer-side runtime helpers for `nativeTheme`,
    `powerSaveBlocker`, and `webContent` calls.
- `patch-layer/packages/runtime/`
  - Reserved for shared runtime health and boot helpers.
- `patch-layer/packages/main/`
  - Reserved for future main-process modules if `main.js` logic is extracted.

Current route extraction ownership:

- `patch-layer/routes/route-catalog.js`
  - Owns the `/home/*` route metadata and menu route metadata.
  - Provides route matching helpers for probes.
  - Provides builders used by the old renderer bundle when route/menu logic is
    delegated out of `renderer.js`.
- `patch-layer/route-readiness-probe.js`
  - Observes route readiness using the route catalog.
- `patch-layer/store-module-visibility-probe.js`
  - Observes visible Vue/Vuex/webpack signals without mutation.
- `patch-layer/ipc-surface-presence-probe.js`
  - Observes IPC surface presence without sending or invoking channels.

Current menu state extraction ownership:

- `patch-layer/packages/menu/menu-state.js`
  - Exposes `window.__CFW_MENU_STATE__`.
  - Provides `getInitialCurrentRoutePath(storage, key, fallbackPath)`.
  - Replaces the old inline `renderer.js` expression
    `N.Z.get(D.Z.CURRENT_ROUTE_PATH) || "/home/general"`.

Current menu order extraction ownership:

- `patch-layer/packages/menu/menu-order.js`
  - Exposes `window.__CFW_MENU_ORDER__`.
  - Provides `readOrder(storage, key)`, `compareMenuItems(...)`, and
    `sortMenuItems(...)`.
  - Replaces the old inline `renderer.js` menu order comparator that read
    `D.Z.MENU_ITEM_ORDER` and sorted `menuItemsWithOrder` directly.

Current settings extraction ownership:

- `patch-layer/packages/settings/settings-defaults.js`
  - Exposes `window.__CFW_SETTINGS_DEFAULTS__`.
  - Provides `normalizeSettings(settings)` and `mergeSettings(settings)`.
  - Replaces the old inline default/merge block in `renderer.js` that built
    `showNewVersionIcon`, `hideAfterStartup`, `randomControllerPort`,
    `runTimeFormat`, `trayOrders`, and adjacent settings defaults.

Current renderer IPC extraction ownership:

- `patch-layer/packages/ipc/ipc-client.js`
  - Exposes `window.__CFW_IPC_CLIENT__`.
  - Provides a renderer IPC channel catalog plus `invoke(...)`,
    `invokeWindow(...)`, and `invokeApp(...)`.
  - Replaces the old direct `ipcRenderer.invoke(...)` calls for the extracted
    app quit, window minimize, window maximize/unmaximize, and pin-window
    call sites.
- `patch-layer/packages/ipc/app-ipc.js`
  - Exposes `window.__CFW_APP_IPC__`.
  - Replaces direct renderer `app` channel invokes for extracted app path,
    version, packaging, app path, login-item, relaunch, and exit call sites.
- `patch-layer/packages/ipc/window-ipc.js`
  - Exposes `window.__CFW_WINDOW_IPC__`.
  - Replaces direct renderer `window` and `window-control` channel invokes for
    visibility, reload, close, fullscreen, always-on-top, show, and
    show-or-hide call sites.
- `patch-layer/packages/ipc/dialog-ipc.js`
  - Exposes `window.__CFW_DIALOG_IPC__`.
  - Replaces direct renderer `dialog` channel invokes for message and open
    dialog call sites.
- `patch-layer/packages/ipc/global-shortcut-ipc.js`
  - Exposes `window.__CFW_GLOBAL_SHORTCUT_IPC__`.
  - Replaces direct renderer `globalShortcut` channel invokes for register,
    unregister, and isRegistered call sites.
- `patch-layer/packages/ipc/runtime-ipc.js`
  - Exposes `window.__CFW_RUNTIME_IPC__`.
  - Replaces direct renderer `nativeTheme`, `powerSaveBlocker`, and
    `webContent` channel invokes for extracted runtime call sites.

## Dist Files

Required baseline files in `app/main/dist/electron/`:

- `index.html`
- `main.js`
- `renderer.js`
- `renderer.js.LICENSE.txt`
- `287.js`
- `295.js`
- `585.js`
- `editor.worker.js`
- `fonts/`
- `static/`

Observed file sizes at baseline:

- `main.js`: 86,505 bytes
- `renderer.js`: 6,947,142 bytes
- `index.html`: 377 bytes

## Build Scripts

- `app/build_default.bat`
  - Changes to the `app/` directory.
  - Runs `build_win_x64.ps1`.
- `app/build_win_x64.ps1`
  - Checks for `app/clash_core/win_x64/static`.
  - Checks for `app/main`.
  - Checks for `app/logo.ico`.
  - Requires `npm`.
  - Uses `npx electron-packager`.
  - Uses `npx asar`.
  - May run `npm install -g electron-packager` or `npm install -g asar` if
    missing.
  - Removes old output directories after prompting.
  - Copies platform static files into packaged `resources/static`.
- Other `build_*.ps1` scripts follow the same packaging model for other
  platforms and architectures.

## Clash Core Layout

`app/clash_core/` contains per-target static bundles:

- `win_x64`
- `win32-ia32`
- `win32-arm64`
- `linux-x64`
- `linux-arm64`

Each platform bundle contains Clash core binaries, service files, proxy helpers,
and default data such as `Country.mmdb`.

## Recommended Refactor Route

Use a narrow, reversible route:

1. Keep the packaged app runnable at every step.
2. Add baseline checks before changing runtime behavior.
3. Add or extend a project-owned module outside `renderer.js` and `main.js`.
4. Integrate that module through the smallest loader or bridge possible.
5. Extract one behavior at a time into human-readable modules.
6. Replace the old call site with a narrow delegation to the extracted module.
7. Keep the app runnable after every extraction.
8. Run the baseline script after every session.
