# Runtime invariants

## Dual-core behavior

- Mihomo is the default for new settings. Legacy Clash remains available, and saved explicit core choices are preserved.
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
- Controller HTTP clients bypass environment proxies and reject redirects so bearer credentials stay on loopback. Host transports keep HTTP response caching disabled.
- External dashboards receive only the loopback controller address, port, and secret. Never write the secret to logs or documentation.

## Connection cleanup

- `connMode` closes core connections when the core routing mode changes (Rule, Global, Direct or Script); it does not represent System Proxy, TUN or Mixin switches.
- `connProxyDisconnect` defaults to enabled. A successful System Proxy on-to-off transition, or a TUN/Mixin/TAP switch-off that actually stops TUN/TAP, closes only matching inbound connection IDs captured before that operation. System Proxy cleanup targets HTTP/HTTPS and, on macOS, SOCKS. Tunnel cleanup targets TUN/Redir/TProxy; legacy TAP also targets SOCKS when System Proxy is off. Unknown inbound types are preserved. Manual clients sharing the same inbound cannot be distinguished from System Proxy or legacy TAP.
- New connections created after the snapshot are preserved. Cleanup is best effort, uses bounded requests and never exposes controller request details in logs. The other connection cleanup settings remain independent.

## Network mode composition

- Composition remains profile, General TUN configuration, then Mixin. YAML Mixin replaces top-level sections; JavaScript Mixin retains control over its returned object. Diagnostics describe accepted configuration without changing this legacy contract.
- The Clash Core configuration action in General opens an in-app status dialog with the last accepted TUN configuration, TAP process state, override diagnostics, and an option to preview the submitted YAML. An unsuccessful controller apply preserves the last accepted payload.
- On Windows, TAP Manage owns `legacyTapMode`: `enabled` allows eligible profiles, `mixin` (default) requires local Mixin authorization, and `disabled` prevents startup without uninstalling the adapter or changing DNS. Migration preserves the former explicit `legacyTapEnabled: false` as disabled; absent/default-on preferences become Mixin-only. Native TUN and legacy TAP remain mutually exclusive.
- Mixin-only TAP cannot be authorized by a subscription or by merely enabling Mixin. Local YAML Mixin must explicitly define `dns.enable: true` and `dns.listen: :53` (or `0.0.0.0:53`). Local JavaScript Mixin must return a top-level `"cfw-tap": true` marker with eligible DNS. This marker is stripped from profile input before Mixin and from the final payload before core submission. The marker is application metadata, never a core configuration option.
- Profile refreshes serialize controller writes per renderer and discard superseded preparation and queued requests. An already submitted controller write finishes before the next write; superseded requests do not continue proxy selection, DNS, or TAP startup effects. TAP route polling cancels abandoned startup before adding its default route, and resume uses the same refresh queue. Selection errors and dialog completions belong to their original request and cannot clear a newer selection, including A -> B -> A.
- Manual profile selection holds the shared proxy-operation lock until configuration, TAP startup/shutdown, and optional connection cleanup finish; repeated mouse/keyboard requests are rejected without changing the selected profile or queuing a later switch. Background refreshes retain the supersession policy above. Tray node choices honor the same busy state; optional Provider health is fetched separately and updates only its originating menu, so it cannot delay node selection or remove available groups on failure.
- Manual proxy switches and routing-mode changes share an operation lock. Loading switches retain a neutral dot at the target position; the background spinner does not replace it. Page navigation and unrelated preferences remain available; settings that restart the core or change active network policy are disabled and guarded again at save time.
- Tray proxy commands reserve the same operation in the main process before sending IPC. A matching renderer acknowledgement releases the reservation; older state messages cannot unlock a newer request. Native menu loading entries replace the affected checkmark and all conflicting commands remain disabled until completion.

## Runtime entries and platform assets

- The title-bar pin is available with Linux X11/Xwayland and hidden on native Wayland, where Electron cannot set always-on-top. Explicit `--ozone-platform=x11` takes precedence over the desktop session. The renderer persists only the native pin state confirmed by the main process.

- `main.js` and `renderer.js` are runtime inputs, not disposable generated files.
- Dashboard and auxiliary page main worlds must use `nodeIntegration: false`, `contextIsolation: true`, and `webSecurity: true`. The browser renderer may execute only in its isolated preload world; do not expose `require`, `process`, generic IPC, filesystem, or module-loader capabilities through `contextBridge`.
- Privileged application IPC accepts only the main window's main frame. The tray indicator may send only its fixed Show action. Download targets are private host-selected temporary files for trusted HTTPS release assets; renderers cannot select paths. Certificate exceptions are exact HTTPS URLs and apply only to the authorized main window.
- The dashboard HTML must not load the privileged renderer or Monaco JavaScript directly. Its content-security policy restricts scripts and active content; the isolated preload loader owns runtime order and asset bases.
- Controller HTTP and WebSocket operations run in the main process; profile downloads run in utility workers. The renderer uses named IPC clients and must not import native transports or bypass Chromium CORS enforcement.
- Auxiliary windows use dedicated channel-specific preload code. The speed indicator preload binds its DOM and two fixed IPC channels without exposing a page-world bridge.
- Monaco is pinned in the root lockfile and built locally as a browser-only runtime before tests and packaging. Its generated manifest and license notices must ship with the application; CDN loading and renderer-time Node imports are forbidden.
- Equivalent helper files in platform directories must remain identical. Core updates must also update binaries, license/source records, and hash manifests.
- Business rules belong in testable modules. Executable entries retain only dependency adaptation and Vue/Electron composition.
