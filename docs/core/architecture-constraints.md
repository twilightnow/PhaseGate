# PhaseGate Architecture Constraints

- Type: core
- Status: active
- Reader: both

## Workspace Constraints

- Runtime state lives in `.phasegate/progress.json`.
- Requirement docs live in `.phasegate/requirements/`.
- Active execution artifacts live in `.phasegate/tasks/` and `.phasegate/contracts/`.
- Disposable outputs live in `.phasegate/scratchpad/`.
- Archived historical artifacts live in `.phasegate/archive/`.

## Execution Constraints

- Only one requirement may be active at a time.
- `currentPhase` is execution-local, not workspace-global.
- Phase 3 dependency order comes from task-book dependencies.
- Phase 3 worker output is written as structured `report.json`.

## Context Constraints

- Prompt phases should use injected context files instead of reconstructing hidden state.
- Phase 4 and Phase 5 should read summaries from `scratchpad/summaries/`, not from a removed progress log.
- Requirement prompts should work against the active requirement rather than all backlog files unless the phase explicitly needs backlog context.

## Known Practical Limits

- Output quality still depends on the quality of requirements, task books, and contracts.
- Some validation remains human judgment, especially in acceptance.
- Phase 3 is parallel by module but execution across requirements is still single-selection only.

## Related

- [overview.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/overview.md)
- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
