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
3. Add a patch layer outside `renderer.js` and `main.js`.
4. Integrate that layer through the smallest loader or bridge possible.
5. Extract one behavior at a time into human-readable modules.
6. Keep the old bundle wired until each extracted behavior is proven equivalent.
7. Run the baseline script after every session.
