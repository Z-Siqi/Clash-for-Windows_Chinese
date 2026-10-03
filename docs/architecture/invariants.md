# Runtime invariants

## Dual-core behavior

- Legacy Clash is the compatibility default; Mihomo is the modern core selected explicitly by the user.
- Both cores share the CFW data directory, profiles, controller secret, and UI state.
- Every core start must pass `-d <CFW data directory>`. Service Mode runs under a system account and must not rely on that account's default home directory.
- Core paths are resolved only by `core-selection.js`. Firewall and service startup code must consume that same result.
- Legacy Clash supports the Script routing mode; packaged Mihomo does not. Capability checks come from `core-capabilities.js`: Mihomo UI and tray surfaces hide Script, its shortcut is unregistered, and stale profile/IPC requests normalize to Rule before reaching the controller.

## Service Mode

- All helpers may start only packaged core files pinned by SHA-256 in protected manifests. Installed cores and helpers reside under Program Files on Windows, `/usr/lib/clash-for-windows-service` on Linux, and `/Library/PrivilegedHelperTools/com.lbyczf.cfw` on macOS. Unix installations and every executable ancestor must be root-owned, non-symlink and unwritable by other users.
- A protected installation policy fixes the shared CFW data directory. Start requests select only an installed core name; they cannot supply an executable path, working directory or proxy-helper path.
- The helper listens only on loopback and requires an installation-specific bearer credential for every request. It rejects browser Origin headers and non-loopback Host headers; stop/shutdown are POST operations. Main-process clients disable environment proxy routing and read credentials from a private file bound to the configured data directory. Credentials never enter renderer IPC or logs.
- Windows migrations stop the fixed service identity through the system service manager and never elevate a legacy helper from the writable profile directory.
- The helper exposes no arbitrary command endpoint and must hide console windows.
- Installation and update must repair partial installations. The application may fall back to local mode after a failure, but it must not silently broaden privileges.
- A successful Windows installation is not reported until the helper responds to its loopback health check.
- Health checks require service protocol version 2; an old helper's unauthenticated successful ping must not enable Service Mode. Installation permits up to 30 seconds for a cold helper startup.
- Native TUN uses the selected core and does not require the legacy TAP adapter. Packaged TAP installation supports Windows x64; Windows ARM64 must not fall back to an i386 kernel driver.

## Ports and controller access

- `mixed-port` and external-controller ports are in the range `1..65535`.
- Selecting `mixed-port` manually disables random-port mode so the choice survives a restart.
- Port-conflict recovery starts only after a connected core reports `mixed-port: 0` repeatedly; restart and core-switch transients must not open the recovery dialog.
- The controller binds to `127.0.0.1` by default. Clients obtain URLs and authentication headers from the shared factory.
- External dashboards receive only the loopback controller address, port, and secret. Never write the secret to logs or documentation.

## Connection cleanup

- `connMode` closes core connections when the core routing mode changes (Rule, Global, Direct or Script); it does not represent System Proxy, TUN or Mixin switches.
- `connProxyDisconnect` defaults to enabled. A successful System Proxy on-to-off transition, or a TUN/Mixin switch-off that actually stops TUN/TAP, closes only connection IDs captured before that operation. Enabling proxies, startup, ordinary profile refreshes and unsuccessful changes do not trigger cleanup.
- New connections created after the snapshot are preserved. Cleanup is best effort, uses bounded requests and never exposes controller request details in logs. The other connection cleanup settings remain independent.

## Bundles and platform assets

- The title-bar pin is available with Linux X11/Xwayland and hidden on native Wayland, where Electron cannot set always-on-top. Explicit `--ozone-platform=x11` takes precedence over the desktop session. The renderer persists only the native pin state confirmed by the main process.

- `main.js` and `renderer.js` are runtime inputs, not disposable generated files.
- Dashboard and auxiliary page main worlds must use `nodeIntegration: false`, `contextIsolation: true`, and `webSecurity: true`. The legacy renderer may execute only in its isolated preload world; do not expose `require`, `process`, generic IPC, filesystem, or module-loader capabilities through `contextBridge`.
- Privileged application IPC accepts only the main window's main frame. The tray indicator may send only its fixed Show action. Download targets are private host-selected temporary files for trusted HTTPS release assets; renderers cannot select paths. Certificate exceptions are exact HTTPS URLs and apply only to the authorized main window.
- The dashboard HTML must not load the privileged renderer or Monaco JavaScript directly. Its content-security policy restricts scripts and active content; the isolated preload loader owns runtime order and asset bases.
- Renderer Axios traffic uses the Node HTTP adapter. Do not allow DOM-global adapter detection to move core API or profile download requests onto XHR, where the isolated origin, CORS, and CSP change legacy behavior.
- Auxiliary windows use dedicated channel-specific preload code. The speed indicator preload binds its DOM and two fixed IPC channels without exposing a page-world bridge.
- Monaco is pinned in the root lockfile and built locally as a browser-only runtime before tests and packaging. Its generated manifest and license notices must ship with the application; CDN loading and renderer-time Node imports are forbidden.
- Equivalent helper files in platform directories must remain identical. Core updates must also update binaries, license/source records, and hash manifests.
- Business rules belong in testable modules. Bundles retain only dependency adaptation and Vue/Electron wiring.
