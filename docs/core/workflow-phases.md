# PhaseGate Workflow Phases

- Type: core
- Status: active
- Reader: both
- Use when: you need the execution model from Phase 0 to Phase 5

## Phase Table

| Phase | Name | Entry | Notes |
|---|---|---|---|
| 0 | Requirements Discussion | `phasegate chat` | |
| 1 | Design Generation (with embedded self-check) | `phasegate run` | |
| ~~2~~ | ~~Design Review~~ | — | **Migrated** — folded into Phase 1 |
| 3 | Parallel Module Development | `phasegate run` | Workers produce self-review bundles |
| 4 | Lightweight Final Review | `phasegate run` | Structured VerdictRecord gate |
| 5 | Acceptance | `phasegate run` | |

**Active phase sequence:** `0 → 1 → 3 → 4 → 5`

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
- AI performs an **embedded design self-check** (consistency, risk, public-surface) as part of the same response.
- On success, runtime sets `design.reviewPassed = true`, syncs design modules and contracts into `progress.json`.
- Advances directly to Phase 3.

## Phase 2 (Migrated)

Phase 2 (Design Review) has been **folded into Phase 1**. If `currentPhase: 2` is found in an existing `progress.json`, it is automatically migrated to `currentPhase: 1` and a `{phaseId: 2, state: 'migrated'}` entry is recorded in `phaseStates`. No AI call is made for Phase 2.

## Phase 3

- Builds a dependency DAG from task books.
- Runs workers wave by wave through the orchestrator.
- Writes worker reports to `.phasegate/scratchpad/{module}/report.json`.
- Writes execution summaries to `.phasegate/scratchpad/summaries/`.
- Advances to Phase 4 when no module failed.

## Phase 4

- **Lightweight final review gate** — validates that worker self-review bundles are complete and risks are acceptable.
- Context: `progress.json`, task books for **done** modules only, contracts, worker reports with self-review bundles, Phase 3 summary.
- AI responds with a structured `VerdictRecord` JSON block (`accepted` / `conditional_pass` / `rejected`).
- `accepted` / `conditional_pass` → gate passes, verdict recorded via `pm.recordPhaseVerdict`, advances to Phase 5.
- `rejected` → `gate_failed` state, execution halts.
- Falls back to legacy PASS/FAIL keyword detection when no JSON block is present.

## Phase 5

- Verifies acceptance criteria for the active requirement.
- Uses worker reports and prior summaries as input.
- Generates `acceptance-guide.md`.
- Finalize archives durable artifacts, clears active execution, and marks the requirement implemented.

## Related

- [progress-model.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/progress-model.md)
- [cli-surface.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/cli-surface.md)
- [phase-transition-manager.ts](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/phase-transition-manager.ts)
