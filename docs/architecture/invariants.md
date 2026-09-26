# Runtime invariants

## Dual-core behavior

- Legacy Clash is the compatibility default; Mihomo is the modern core selected explicitly by the user.
- Both cores share the CFW data directory, profiles, controller secret, and UI state.
- Every core start must pass `-d <CFW data directory>`. Service Mode runs under a system account and must not rely on that account's default home directory.
- Core paths are resolved only by `core-selection.js`. Firewall and service startup code must consume that same result.
- Legacy Clash supports the Script routing mode; packaged Mihomo does not. Capability checks come from `core-capabilities.js`: Mihomo UI and tray surfaces hide Script, its shortcut is unregistered, and stale profile/IPC requests normalize to Rule before reaching the controller.

## Service Mode

- Windows and Linux helpers may start only packaged core files pinned by SHA-256 in their root-owned manifests. Linux helper updates deploy the executable and manifest together.
- The helper listens only on loopback, exposes no arbitrary command endpoint, and must hide console windows.
- Installation and update must repair partial installations. The application may fall back to local mode after a failure, but it must not silently broaden privileges.
- A successful Windows installation is not reported until the helper responds to its loopback health check.

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

- `main.js` and `renderer.js` are runtime inputs, not disposable generated files.
- Dashboard and auxiliary page main worlds must use `nodeIntegration: false`, `contextIsolation: true`, and `webSecurity: true`. The legacy renderer may execute only in its isolated preload world; do not expose `require`, `process`, generic IPC, filesystem, or module-loader capabilities through `contextBridge`.
- The dashboard HTML must not load the privileged renderer or Monaco JavaScript directly. Its content-security policy restricts scripts and active content; the isolated preload loader owns runtime order and asset bases.
- Renderer Axios traffic uses the Node HTTP adapter. Do not allow DOM-global adapter detection to move core API or profile download requests onto XHR, where the isolated origin, CORS, and CSP change legacy behavior.
- Auxiliary windows use dedicated channel-specific preload code. The speed indicator preload binds its DOM and two fixed IPC channels without exposing a page-world bridge.
- Monaco is pinned in the root lockfile and built locally as a browser-only runtime before tests and packaging. Its generated manifest and license notices must ship with the application; CDN loading and renderer-time Node imports are forbidden.
- Equivalent helper files in platform directories must remain identical. Core updates must also update binaries, license/source records, and hash manifests.
- Business rules belong in testable modules. Bundles retain only dependency adaptation and Vue/Electron wiring.
