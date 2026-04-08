# PhaseGate Progress Model

- Type: core
- Status: active
- Reader: both
- Use when: you need to understand persisted execution state
- Source of truth: current implementation

## Purpose

PhaseGate separates requirement accumulation from active execution.
The backlog lives in `.phasegate/requirements/`.
Execution state lives only in `.phasegate/progress.json`.

## Authoritative State

`progress.json` is the only authoritative state file.
There is no generated `progress.md` in the current model.

Key fields:

```json
{
  "projectName": "demo",
  "locale": "en",
  "currentPhase": 1,
  "activeRequirement": null,
  "requirements": [],
  "design": {
    "modules": [],
    "contracts": [],
    "reviewPassed": false
  },
  "modules": [],
  "codeReviewPassed": false,
  "blockers": [],
  "phase4Verdict": null,
  "phaseStates": []
}
```

## Semantics

- `activeRequirement`
  - The single requirement currently bound to execution.
  - `null` means execution is idle.
- `currentPhase`
  - Execution-local phase for the active requirement.
  - `0` means no active execution.
  - Valid active values: `1`, `3`, `4`, `5`. Legacy value `2` is migrated to `1` on read.
- `requirements[]`
  - Backlog entries discovered from `.phasegate/requirements/*.md`.
  - Status values: `draft`, `approved`, `selected`, `implemented`, `archived`.
- `design`
  - Phase 1 outputs (task books, contracts). `reviewPassed` is set to `true` when the embedded Phase 1 self-check passes.
- `modules`
  - Runtime module state used during Phase 3 orchestration.
- `codeReviewPassed`
  - Legacy Phase 4 gate result flag (boolean). Superseded by `phase4Verdict`.
- `phase4Verdict`
  - Structured `VerdictRecord` written by Phase 4 gate. Shape:
    ```json
    {
      "verdict": "accepted" | "conditional_pass" | "rejected",
      "summary": "...",
      "findings": [{ "level": "info" | "warning" | "blocking", "module": "...", "message": "..." }]
    }
    ```
- `phaseStates[]`
  - Per-phase execution state entries. Shape: `{ phaseId, state, enteredAt?, note? }`.
  - Used to record migration events (e.g., `{phaseId: 2, state: 'migrated'}`) and phase verdicts.
- `blockers`
  - Known blocking runtime issues.

## Lifecycle Rules

- `phasegate chat` can add or revise requirement docs without starting execution.
- `phasegate select <requirement>` marks one approved requirement as active.
- `phasegate run` executes only the selected requirement.
- Completing Phase 5 finalizes artifacts, marks the active requirement `implemented`, and resets execution to idle.

## Related

- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
- [workspace-layout.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/guides/workspace-layout.md)
- [progress-manager.ts](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/progress-manager.ts)
