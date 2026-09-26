# Testing guide

## Standard entry point

Run from the repository root:

```sh
npm test
```

The command uses Node's built-in test runner, requires no third-party test framework, and supports Windows, Linux, and macOS. The minimum Node version is 18.

The test entry points first run `npm run build:monaco`. This creates the ignored `app/build/generated/monaco/` directory from the exact `monaco-editor` and `esbuild` versions in the root lockfile. The generated manifest records dependency identity, license files, and SHA-256 hashes; architecture tests verify every emitted asset. Packaging scripts run the same build before creating the application ASAR.

Focused commands:

```sh
npm run test:unit
npm run test:integration
npm run test:architecture
npm run test:application
```

The legacy Windows workflow may still invoke `scripts/refactor/check-baseline.ps1`, but that script is only a compatibility wrapper around `npm test`; it is not a separate test source.

## Test layers

- `app/test/unit/`: business behavior with injected fakes, serialization, compatibility layers, and composition assertions.
- `app/test/integration/`: packaged core hashes, native configuration checks, real core processes, and loopback APIs.
- `app/test/architecture/`: dependency direction, ownership boundaries, documentation policy, and JavaScript syntax.
- `app/test/fixtures/`: minimal configurations without user data or secrets.

The application gate is a subset of integration tests. It executes the named renderer factories and Vuex composition with the shipped Vue/Vuex runtime, temporary data directories, and injected operating-system boundaries. It also applies configurations to both packaged native cores over loopback and checks selected proxies and modes. These tests do not launch the Electron GUI or exercise real DNS, firewall, proxy, or service settings. Platform-specific core tests skip on unsupported targets; portable application tests still run. `npm test` discovers only `.test.js` files so fixture harnesses are not counted as test cases.

## Adding tests

Every bug fix needs at least one regression test that fails against the previous implementation. Prefer extracting platform policy into cross-platform unit tests. When a native binary is necessary, run the real integration test on supported platforms and skip it explicitly elsewhere.

Renderer application tests must execute the production `Language` class rather than invent translation methods in mocks. Profile tests exercise the click/switch handlers, error dialogs, and the Proxies page data transformation, including malformed YAML, core validation rejection, and recovery with another valid profile. OS operations and dialog presentation are injected; application behavior is taken from the named production modules.

Shared renderer tests execute the production component factories with the shipped Vue/Vuex runtime. They check route matching and keep-alive metadata, theme updates, scroll restoration, dialog promises and keyboard events, editor validation and disposal, semantic API calls, Monaco provider registration, and disabled editor links. Node tests inspect real Vue virtual nodes but do not claim browser layout or Electron GUI coverage. Monaco's DOM implementation and native operations are injected where needed.

Window security tests require the production BrowserWindow options, HTML entry, preload loader, and auxiliary-window preload to agree: page worlds have no Node integration, the dashboard exposes no generic bridge, and Monaco loads before the renderer in the isolated preload world. When an Electron runtime is available, use `app/test/fixtures/electron-security-smoke` with temporary Electron `home`, `userData`, `sessionData`, `temp`, and `logs` paths. The fixture verifies that the real page world cannot observe `process`, `require`, runtime paths, or Monaco while the Vue root still mounts; it also drives Settings navigation, Script mode switching, initial Profile download, and an existing Profile update against a no-CORS loopback controller.

Profile parser and user-script tests inject network, filesystem, logging, and code-loading boundaries. They cover parser ordering, declarative YAML/command mixins, subscription metadata, script selection, and production composition. Profiles/Server and General workflow tests call their owners directly with fake dialogs, stores, filesystem/native services, and timers; architecture checks ensure the executable entry does not regain those owners. The Feedback page bridge is rendered with the shipped Vue runtime; external navigation and advertisement refresh are verified with injected fakes. Update-runtime and interval-scheduler tests cover listener cleanup and permanent task shutdown independently of Electron.

Home, Settings, Proxies, Connections, and Logs tests execute their page owners with injected platform and transport boundaries. Composition assertions ensure the renderer entry remains small and delegates to those named factories.

Tests may use only temporary directories and loopback ports. They must not change real profiles, system proxy settings, Service Mode, firewall rules, or the registry. CI runs the standard entry point on both Windows and Linux.
