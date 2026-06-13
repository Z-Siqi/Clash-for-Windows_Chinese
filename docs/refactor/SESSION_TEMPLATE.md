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
- Do not directly hand-edit app/main/dist/electron/renderer.js for feature work.
- Do not rewrite the whole app.
- Keep old logic connected and runnable after each extraction.
- Ask before deleting files, initializing git, installing dependencies, or
  running packaging scripts.
- End by updating docs/refactor/CURRENT_STATE.md with completed work,
  changed files, verification result, next task, and rollback method.
```

## Session Checklist

- Read current refactor docs.
- Run `scripts/refactor/check-baseline.ps1`.
- Inspect only the relevant runtime snippets.
- Make one small, reversible change.
- Verify the baseline still passes.
- Record the result in `CURRENT_STATE.md`.

## Acceptance Criteria

- Existing entry chain remains valid unless the task explicitly changes it.
- `renderer.js` and `main.js` are not accidentally changed.
- New code has a clear owner path outside generated or dependency files.
- The old packaged app can still load `index.html` and `renderer.js`.
- Rollback is documented.
