# Refactor Decisions

## Decision Log

### 001 - Use a Maintainable Patch Layer

Use a maintainable patch layer plus gradual extraction instead of attempting a
full rewrite of the packaged renderer bundle.

Reason:

- `renderer.js` is a large minified webpack bundle without source maps.
- Direct manual edits inside the bundle are hard to review and easy to break.
- A patch layer gives each later change a clear integration point and rollback
  path.

### 002 - Preserve the Packaged Entry Chain

Preserve the current entry chain unless a later session explicitly changes it
with verification:

`package.json` -> `dist/electron/main.js` -> `index.html` -> `renderer.js`

Reason:

- This is the currently runnable app shape.
- Packaging scripts assume `app/main` is the Electron app root.

### 003 - Baseline Before Behavior Changes

Every refactor session should start by running:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1
```

Reason:

- It catches accidental edits to `main.js` and `renderer.js`.
- It confirms the renderer loading path is still intact.

### 004 - Do Not Edit Runtime Dependencies In Place

Do not edit `app/main/node_modules/`.

Reason:

- Dependency edits are hard to reproduce.
- Packaging may prune or replace dependencies.
- Any required override should live in a documented project-owned patch layer.

### 005 - Treat Packaging As Explicit Verification

Do not run `build_*.ps1` as an automatic smoke test.

Reason:

- The scripts can prompt, remove output folders, and install global npm
  packages.
- Packaging is useful, but it should be run only when explicitly chosen.

### 006 - Git Should Be Initialized Before Larger Work

The workspace root is not currently a git repository. Initialize git before
making behavior changes or larger extraction steps.

Reason:

- The current app is an extracted binary/package tree.
- Refactor work needs reviewable diffs and a simple rollback path.
