# Repository instructions for coding agents

These rules apply to the whole repository. Preserve user work and keep changes scoped to the requested task.

## Repository shape

- This project maintains an unpacked, production Electron application. There is no complete original Vue/Webpack source tree.
- `app/main/dist/electron/main.js` and `renderer.js` are executable CommonJS entry points, not disposable build output.
- Maintainable behavior belongs in CommonJS modules under `app/main/dist/electron/core`, `features`, or `entry`; executable entries only adapt and delegate.
- `app/clash_core/<target>/static/files` contains packaged platform assets. The same source fix may need to be mirrored across target packages.
- `scripts/refactor/apply-*.js` records historical byte-preserving migrations. Do not run an apply script blindly on an already-migrated tree.

## Safe editing

- Inspect `git status --short` before editing. Never discard, relocate, stage, or overwrite unrelated user changes.
- Do not use destructive Git commands, mass formatting, or whole-bundle regeneration.
- Keep executable entries readable and free of numeric webpack module IDs or loaders.
- Prefer extracting testable behavior over adding more inline bundle logic. Remove the replaced inline owner so behavior is not duplicated.
- Add short comments for non-obvious runtime constraints. Do not create session journals or temporary refactor narratives in `docs`.
- Do not edit vendored `node_modules` unless the task explicitly requires a pinned vendor patch.
- Never commit generated `app/output`, logs, user profiles, secrets, temporary data, or local settings.

## Architecture boundaries

- `core/` is framework-neutral shared infrastructure. It must not import `features/` or `entry/`.
- `features/<name>/` owns one capability. A feature may import its own files and `core/`, but not another feature.
- `entry/<process>/` composes features and adapts Electron IPC.
- Electron objects and system operations should be dependency-injected so unit tests can use fakes.
- Renderer features call the semantic Clash API in `core/network/clash-api.js`; do not scatter endpoint strings or raw transport calls.

## Product invariants

- Legacy Clash remains supported and is the default; Mihomo is an explicit alternative.
- Both cores use the same CFW data directory. Always pass that directory explicitly when starting a core, including Service Mode.
- Core selection, firewall rules, service allow-lists, and packaged filenames must agree for every supported platform and architecture.
- User-entered TCP ports are integers in `1..65535`. A manual mixed-port choice must not be silently replaced by random-port startup behavior.
- Keep the controller loopback-only by default. Do not weaken authentication, CORS, certificate, navigation, or firewall policy to make a UI test pass.
- Service helpers may start only hash-allow-listed packaged cores. Do not restore arbitrary command execution.
- Never print or persist controller secrets in logs, tests, screenshots, or documentation.

## Tests

- The canonical gate is `npm test` from the repository root. It must work on Windows and Linux with Node 18 or newer.
- Tests live under `app/test/architecture`, `app/test/unit`, and `app/test/integration`; fixtures live under `app/test/fixtures`.
- Use `npm run test:unit`, `npm run test:integration`, or `npm run test:architecture` for focused work.
- Add a regression test for every bug fix. Prefer a unit test for policy and an integration test when native-core compatibility is the claim.
- Tests must use temporary directories and loopback ports. They must not modify a developer's real CFW profile, proxy settings, firewall, service, or registry.
- Platform-specific tests must skip clearly on unsupported targets; portable logic must still run everywhere.
- `scripts/refactor/check-baseline.ps1` is only a Windows compatibility wrapper around `npm test`.

## Documentation and delivery

- `docs` is for stable, human-oriented project architecture, invariants, decisions, and development procedures.
- Explain implementation-local details beside the code. Update project documentation only when a durable contract changes.
- Before delivery, run the narrow tests while iterating, then `npm test` and inspect `git diff --check` plus `git status --short`.
- Stage and commit only task-owned paths. Report skipped platform checks and any remaining unverified runtime behavior.
