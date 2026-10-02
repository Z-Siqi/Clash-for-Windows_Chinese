# Electron architecture

## Runtime model

```text
main.js (Electron main process)
  |-- BrowserWindow, tray, native menus, and application lifecycle
  |-- operating-system capabilities and ipcMain handlers
  `-- entry/main composition root
                         <-> IPC
renderer.js (Vue 2 renderer process)
  |-- routing, Vuex, page components, and localized text
  |-- semantic IPC clients for Clash HTTP and WebSocket operations
  `-- General, Proxies, Logs, Connections, and other views
```

The dashboard runs with `sandbox: true`, `nodeIntegration: false` and `contextIsolation: true`. Its small sandboxed preload requires only Electron and keeps its IPC object private to isolated world 999. After DOM readiness, the main process injects the fixed local Monaco asset and the browser renderer into that world, checking the renderer's SHA-256 manifest first. The renderer is built from the readable CommonJS source with browser-targeted esbuild; Node built-ins are rejected during compilation. The page main world receives no generic Node or IPC bridge and cannot access `process`, `require`, runtime paths or Monaco. Both worlds' CSP disallows string evaluation. User JavaScript executes in separate utility workers rather than the renderer. Native controller transport and fixed public-content requests run in the host; Chromium CORS enforcement remains enabled.

`main.js` and `renderer.js` are small executable CommonJS entry points. They delegate to named composition modules below `entry/main` and `entry/renderer`; numeric webpack module tables and numeric loaders are not permitted in production source.

## Module layers

| Layer | Responsibility | Dependency rule |
| --- | --- | --- |
| `core/` | Shared infrastructure such as Clash transport, semantic APIs, and core selection | May depend only on modules inside `core/` |
| `features/<feature>/` | One product capability, such as windows, tray, TUN, or Service Mode | May depend on its own feature and `core/` |
| `entry/<process>/` | Injects Electron objects and composes multiple features | May compose `core/` and `features/` |
| Executable entries | Start the Electron main and renderer composition roots | Must remain small and contain no product behavior |

Architecture tests reject upward dependencies from `core/` and horizontal dependencies between features.

Native network enumeration, local core lifecycle, controller REST operations and
WebSocket subscriptions are owned by the main process. Renderer clients use named
IPC operations; callers cannot supply controller endpoints, transport overrides,
core executable paths or process IDs. These handlers authorize the dashboard's
main frame. Core startup resolves the packaged binary locally and accepts only
the standard or portable application data directory.

Settings and profile-list repositories also run in the main process. Their narrow
synchronous IPC preserves Vuex's persist-before-publish behavior; core configuration
initialization and port randomization use asynchronous IPC. The PAC listener runs
in the main process and binds only to loopback. Profile reads, modification times,
and orphan cleanup are named operations restricted to the configured profile folder.
Service Mode, system proxy, TAP, DHCP renewal, fixed terminal choices and current
core log reads are owned by the main process. Saved Profile and Proxy action
scripts execute in a separate Electron utility process, with notification, dialog
and DNS context operations mediated by the host. A script that does not finish
within 30 seconds terminates its worker and rejects pending script jobs. User scripts
retain their intentional Node capabilities; the utility process is not an OS sandbox
for those user-authored programs. Saved Mixin and tray scripts use the same worker;
Mixin validation compiles syntax without executing the submitted source. Profile
downloads and configured parsers use a separate worker with saved settings and
profile metadata, a two-minute deadline, and cancellation by its requesting frame.
The Router page also delegates DHCP startup, stop and live gateway/DNS policy to
the main process. The host validates the selected local interface and subnet,
owns the fixed UDP port 67 listener and its power-save blocker, and releases both
on dashboard navigation, destruction or application shutdown. Tests use fake
servers and never send DHCP packets to the developer's network.

Port availability checks and random candidate selection use a named main-process
interface bound to loopback. Mixed-port changes still require confirmation from
the core that it activated the requested port. Settings opens parser, script and
GUI logs by fixed identity rather than supplying a filesystem target.

External editors receive only a private temporary document. The host loads the
editor command from saved settings and spawns it without a shell; shell pipelines
and redirection are not supported in custom editor commands. GeoIP downloads and
archive extraction are hosted in the main process and replace only the fixed
`Country.mmdb` atomically, with bounded downloads and expanded archives.

User-defined executables come only from saved settings and their process handles
remain in the main process. Provider editing resolves names from the last
successfully applied configuration. Generated cache files stay under the fixed
provider cache directories; other File providers require a matching native file
selection before access is granted. Monaco cache links use validated hashes,
never renderer-supplied filesystem paths. Folder and current-log navigation also
use fixed host operations. HTTPS external links and loopback HTTP dashboard links
are validated by the host before opening.

## Primary owners

- `core/network/`: controller-port resolution, Axios/Got/WebSocket factories, and the semantic Clash REST API.
- `core/clash-core/`: resolves legacy Clash or Mihomo for the selected platform and architecture and publishes routing-mode capabilities shared by renderer actions, pages, shortcuts, and tray menus.
- `features/clash-core/`: core process lifecycle, API compatibility, and the General page. `general-page-workflow.js` owns page state, watchers, interactions, native side effects, and route lifecycle; `general-page.js` owns the page, its dedicated child components, and their render functions.
- `features/service-mode/`: Service Mode installation, update, and status behavior for each platform.
- `features/tun/`: TUN configuration and the tun2socks lifecycle.
- `features/network/`: system proxy, firewall, and related operating-system networking behavior.
- `features/settings/`: settings loading and defaults.
- `features/settings/core-config-repository.js`: core configuration initialization, legacy port migration, and startup port persistence.
- `features/profiles/`: profile preparation/application, provider path rewriting, profile list persistence, and selected-proxy snapshots. `server-page-workflow.js` owns the Profiles/Server page state, profile actions, download cancellation, file watcher, and route lifecycle. `server-page.js` owns the page shell and QR dialog; `profile-editor-page.js` and `rule-editor-page.js` own the two embedded editors.
- `features/providers/page.js`: owns the Providers page, provider refresh/health-check/edit interactions, and its page-specific button component.
- `features/router/page.js`: owns the Router/Hijack page, DHCP configuration dialog, client aliases and gateway selection. `register-dhcp-ipc.js` owns the native server lifecycle.
- `features/home/page.js`: owns the Home application shell, startup orchestration, core/TUN/configuration lifecycle, scheduled profile updates, tray traffic rendering, main menu, and status bar.
- `features/settings/page.js`: owns the Settings page, its local controls, editor/file workflows, core selection, and settings navigation.
- `features/proxies/page.js`: owns the Proxies page, group and provider projection, latency tests, selection, filtering, animation, and route lifecycle.
- `features/connections/page.js`: owns the Connections page and detail dialog, stream lifecycle, filtering, ordering, traffic formatting, and connection closure interactions.
- `features/logs/page.js`: owns the Logs page, structured and legacy log parsing, stream lifecycle, filtering, preload, copying, and rendering.
- `features/profiles/profile-parser.js`: profile download metadata, parser chains, command/YAML mixins, and three-way merge handling.
- `features/scripts/user-script-runner.js`: Profile and Proxy user-script loading and execution with injected runtime capabilities.
- `features/application-state/`: renderer state, getters, mutations, and actions; receives platform capabilities as dependencies.
- `entry/main/register-core-ipc.js`: main-process IPC composition across features.
- `entry/renderer/`: composes profile/TUN/network behavior and Vuex with settings/profile repositories. Existing page mutation/action names remain compatible.
- `core/i18n/language.js`: the shared translation catalog and legacy language-selection semantics.
- `core/runtime/`: platform identities, value formatting, module interoperability, and the page interval scheduler without Vue or Electron dependencies.
- `features/application/update-runtime.js`: self-update download progress, listener cleanup, and platform installation mechanics. Page code owns only the user-facing update decision flow.
- `features/renderer-ui/`: routing policy, the application shell, shared component factories, dialog registration, native UI actions, and Monaco YAML language integration.
- `features/feedback/page.js`: the Feedback/About page, its external-link policy, advertisement cache refresh, and lazy-image state.
- `entry/renderer/mount-application.js`: installs the shared dialogs, capability plugin, global mixin, and root Vue instance. The root uses a render function and does not require template compilation.
- `entry/renderer/global-mixin.js`: adapts Vuex settings, platform predicates, restart IPC, and route scroll restoration for every page.
- `entry/renderer/capabilities.js` and `utilities.js`: compose feature capabilities for renderer consumers; Electron, filesystem, store, and other runtime dependencies are injected.

## Shared renderer UI

Shared components live under `features/renderer-ui/components/`. Each exports a named factory accepting its runtime dependencies. `entry/renderer/create-shared-components.js` constructs them and publishes the stable dialog names. Styles are stored separately in `dist/electron/styles.css`.

`features/renderer-ui/component.js` attaches render functions and preserves the original Vue scope IDs. The migrated render functions retain the established DOM, classes, slots, and event contracts so packaged CSS and existing page callers remain compatible. Vue and Babel helpers are loaded as ordinary declared dependencies. Monaco is an exact, lockfile-controlled build-time dependency compiled into a browser-only asset under `app/build/generated/monaco/` and injected into packages before ASAR creation.

The singleton dialog names (`$alert`, `$code`, `$diff`, `$dns`, `$input`, `$menu`, `$script`, `$select`, and `$toast`) remain stable. Install the global mixin before constructing these instances so dialogs receive the same settings, semantic Clash API, and platform computed properties as routed pages. Platform and native capabilities are composed at renderer entry points rather than imported across feature boundaries. Monaco link detection is disabled in embedded editors so an editor upgrade cannot bypass the application's public external-navigation policy through a private Monaco opener API.

`scripts/build/build-monaco.js` is the only owner of the Monaco browser build. It checks the expected Monaco, DOMPurify, and esbuild versions, emits local worker and style assets, copies license notices, and writes SHA-256 hashes to `manifest.json`. Generated assets are intentionally ignored by Git and are rebuilt by install, every test entry point, and every packaging script; production packaging must never fetch Monaco from a CDN. The main-process sandbox loader supplies explicit Monaco and renderer asset bases because neither script is loaded by a page `<script>` element. `scripts/build/build-renderer.js` builds the browser renderer and records its source inputs and SHA-256 checksum.

Settings and profile-list writes use same-directory atomic replacement. Store mutations publish the new persisted state only after the write succeeds. Local-storage preferences keep their existing keys, and SSID overrides do not replace permanent TUN, mixin, or system-proxy preferences. Renderer refreshes are serialized per component instance to prevent asynchronous mixins from applying configurations out of order.

## How to trace runtime behavior

Start from `main.js` or `renderer.js`, follow the named composition root, and then open the owning feature. Cross-feature wiring belongs in `entry/`; product behavior belongs in the corresponding feature. Architecture tests reject numeric webpack loaders and verify that the entries continue to delegate to named modules.
