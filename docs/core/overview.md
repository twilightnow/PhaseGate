# PhaseGate Overview

- Type: core
- Status: active
- Reader: both

## What PhaseGate Does

PhaseGate is a staged AI coding workflow for repositories that need more discipline than a single long-running chat.

It separates work into two layers:

- a requirement pool in `.phasegate/requirements/`
- one active execution flow tracked by `progress.json`

## Why The Model Matters

- New requirements can keep accumulating while another requirement is being executed.
- Execution remains single-threaded across requirements.
- Temporary run output stays in `scratchpad/`.
- Durable artifacts can be archived after finalize.

## Key Runtime Components

- `ProgressManager`
  - Reads and writes `progress.json`
  - Syncs requirement docs into the backlog model
- `PhaseExecutor`
  - Prepares context for prompt-driven phases
- `PhaseTransitionManager`
  - Evaluates phase gates and advances execution
- `Orchestrator`
  - Runs Phase 3 module workers

## Current State Model

- `progress.json` is the only state source
- `activeRequirement` binds execution to one requirement
- `currentPhase` is local to that active requirement
- phase summaries live under `.phasegate/scratchpad/summaries/`

## Related

- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
- [progress-model.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/progress-model.md)
- [architecture-constraints.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/architecture-constraints.md)
