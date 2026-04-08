# PhaseGate Workflow Phases

- Type: core
- Status: active
- Reader: both
- Use when: you need the execution model from Phase 0 to Phase 5

## Phase Table

| Phase | Name | Entry |
|---|---|---|
| 0 | Requirements Discussion | `phasegate chat` |
| 1 | Design Generation | `phasegate run` |
| 2 | Design Review | `phasegate run` |
| 3 | Parallel Module Development | `phasegate run` |
| 4 | Code Review | `phasegate run` |
| 5 | Acceptance | `phasegate run` |

## Core Rules

- Phase 0 accumulates or revises requirements only.
- Execution requires one selected requirement.
- `currentPhase` applies only to the active requirement.
- If `activeRequirement` is `null`, execution is idle.

## Phase 0

- Start or continue discussion with `phasegate chat`.
- Gate approval syncs discovered requirement files into `progress.json`.
- Approved requirements remain in the backlog until explicitly selected.

## Select

- Use `phasegate select <requirement>` to bind one approved requirement to execution.
- Selection sets `activeRequirement` and resets execution to Phase 1.

## Phase 1

- Generates `.phasegate/tasks/*.md` and `.phasegate/contracts/*.md` for the active requirement.
- On success, runtime syncs design modules and contracts into `progress.json`.
- Advances to Phase 2.

## Phase 2

- Reviews and normalizes task books and contracts.
- Gate passes when all contracts are finalized.
- Advances to Phase 3.

## Phase 3

- Builds a dependency DAG from task books.
- Runs workers wave by wave through the orchestrator.
- Writes worker reports to `.phasegate/scratchpad/{module}/report.json`.
- Writes execution summaries to `.phasegate/scratchpad/summaries/`.
- Advances to Phase 4 when no module failed.

## Phase 4

- Reviews only modules that finished successfully in Phase 3.
- Uses `progress.json`, task books, contracts, worker reports, and Phase 3 summary as context.
- Gate passes when the review verdict is PASS and the phase-4 summary is persisted under `scratchpad/summaries/`.
- Advances to Phase 5.

## Phase 5

- Verifies acceptance criteria for the active requirement.
- Uses worker reports and prior summaries as input.
- Generates `acceptance-guide.md`.
- Finalize archives durable artifacts, clears active execution, and marks the requirement implemented.

## Related

- [progress-model.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/progress-model.md)
- [cli-surface.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/cli-surface.md)
- [phase-transition-manager.ts](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/phase-transition-manager.ts)
