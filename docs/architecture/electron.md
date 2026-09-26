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
  |-- Clash HTTP and WebSocket clients
  `-- General, Proxies, Logs, Connections, and other views
```

The dashboard page runs with `nodeIntegration: false` and `contextIsolation: true`. `preload.js` loads Monaco and the readable CommonJS renderer composition in the isolated preload world after the DOM is ready. The page main world receives no generic Node or IPC bridge and cannot access `process`, `require`, runtime paths, or the Monaco object. Its CSP disallows string evaluation; the isolated world's own CSP retains `unsafe-eval` only because user-script compatibility still requires it. Axios is explicitly pinned to its Node HTTP adapter before the renderer loads so DOM globals cannot silently select XHR and subject core or profile requests to the isolated world's origin and CSP. The preload remains unsandboxed only for this compatibility loader; moving the remaining privileged renderer operations behind narrow main-process IPC is required before enabling Chromium renderer sandboxing.

`main.js` and `renderer.js` are small executable CommonJS entry points. They delegate to named composition modules below `entry/main` and `entry/renderer`; numeric webpack module tables and numeric loaders are not permitted in production source.

## Module layers

| Layer | Responsibility | Dependency rule |
| --- | --- | --- |
| `core/` | Shared infrastructure such as Clash transport, semantic APIs, and core selection | May depend only on modules inside `core/` |
| `features/<feature>/` | One product capability, such as windows, tray, TUN, or Service Mode | May depend on its own feature and `core/` |
| `entry/<process>/` | Injects Electron objects and composes multiple features | May compose `core/` and `features/` |
| Executable entries | Start the Electron main and renderer composition roots | Must remain small and contain no product behavior |

Architecture tests reject upward dependencies from `core/` and horizontal dependencies between features.

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
- `features/router/page.js`: owns the Router/Hijack page, DHCP configuration dialog, client aliases, gateway selection, and DHCP server lifecycle.
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

`scripts/build/build-monaco.js` is the only owner of the Monaco browser build. It checks the expected Monaco, DOMPurify, and esbuild versions, emits local worker and style assets, copies license notices, and writes SHA-256 hashes to `manifest.json`. Generated assets are intentionally ignored by Git and are rebuilt by install, every test entry point, and every packaging script; production packaging must never fetch Monaco from a CDN. The isolated preload loader supplies explicit Monaco and renderer asset bases because neither script is loaded by a page `<script>` element.

Settings and profile-list writes use same-directory atomic replacement. Store mutations publish the new persisted state only after the write succeeds. Local-storage preferences keep their existing keys, and SSID overrides do not replace permanent TUN, mixin, or system-proxy preferences. Renderer refreshes are serialized per component instance to prevent asynchronous mixins from applying configurations out of order.

## How to trace runtime behavior

Start from `main.js` or `renderer.js`, follow the named composition root, and then open the owning feature. Cross-feature wiring belongs in `entry/`; product behavior belongs in the corresponding feature. Architecture tests reject numeric webpack loaders and verify that the entries continue to delegate to named modules.
