# Workspace Layout

- Type: guide
- Status: active
- Reader: both
- Use when: you need to know what belongs under `.phasegate/`

## Layout

```text
.phasegate/
  requirements/
  tasks/
  contracts/
  scratchpad/
  archive/
  progress.json
  phasegate.config.json
```

## Responsibilities

### `requirements/`

- Backlog of requirement documents.
- Files can be added or revised during Phase 0 discussion.
- Not blocked by active execution.

### `tasks/`

- Active task books for the currently selected requirement.
- Rebuilt or updated during Phase 1 and reviewed in Phase 2.

### `contracts/`

- Active interface contracts for the currently selected requirement.
- Finalized in Phase 2.

### `scratchpad/`

- Disposable execution output.
- Common contents:
  - `coordinator/brief.md`
  - `{module}/report.json`
  - `summaries/phase-3-summary.md`
  - `summaries/phase-4-summary.md`
  - `summaries/phase-5-summary.md`

### `archive/`

- Historical execution artifacts worth keeping.
- Populated during finalize after Phase 5.
- Not a dumping ground for every temporary file.

### `progress.json`

- Only authoritative execution state file.
- Tracks `activeRequirement`, `currentPhase`, requirement statuses, runtime module statuses, and blockers.

### `phasegate.config.json`

- Local configuration for adapter selection and scope routing.

## Notes

- The current implementation does not maintain `.phasegate/progress.md`.
- Summaries that used to live in a progress log are now kept under `scratchpad/summaries/`.

## Related

- [progress-model.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/progress-model.md)
- [getting-started.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/guides/getting-started.md)
