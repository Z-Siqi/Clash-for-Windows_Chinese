# Refactor Session Template

Use this template at the start of each future Codex refactor conversation.

## Prompt

```text
Working directory: D:\Documents\CFW_Opt

Continue the packaged Electron app refactor. Before changing anything, read:
- docs/refactor/CURRENT_STATE.md
- docs/refactor/MODULE_MAP.md
- docs/refactor/DECISIONS.md

Run the baseline check:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refactor\check-baseline.ps1

Task for this session:
[describe one small PR-sized goal]

Constraints:
- Do not edit app/main/node_modules.
- Do not broadly hand-edit app/main/dist/electron/renderer.js for feature work.
- Small, mechanical edits to renderer.js/main.js are allowed only when they
  remove or delegate an extracted behavior to a project-owned module.
- Do not rewrite the whole app.
- Keep the app runnable after each extraction, but require the old call site to
  delegate to the extracted module.
- Deleting the extracted module should fail baseline, smoke, or runtime
  verification for that extracted behavior.
- Ask before deleting files, initializing git, installing dependencies, or
  running packaging scripts.
- End by updating docs/refactor/CURRENT_STATE.md with completed work,
  changed files, verification result, current main/renderer hashes, next task,
  and rollback method.
```

## Session Checklist

- Read current refactor docs.
- Run `scripts/refactor/check-baseline.ps1`.
- Inspect only the relevant runtime snippets.
- Make one small, reversible enforced extraction.
- Verify the baseline still passes.
- Record the result in `CURRENT_STATE.md`.

## Acceptance Criteria

- Existing entry chain remains valid unless the task explicitly changes it.
- `renderer.js` and `main.js` are not accidentally changed; any intentional
  change is narrow, anchored, and documented.
- New code has a clear owner path outside generated or dependency files.
- Old logic for the extracted behavior delegates to the new owner path.
- Removing the extracted module would break the relevant verification.
- The old packaged app can still load `index.html` and `renderer.js`.
- Rollback is documented.
