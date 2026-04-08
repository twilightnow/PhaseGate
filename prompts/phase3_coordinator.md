# Phase 3: Coordinator Reference

This file is reference guidance only. The current orchestrator builds its own coordinator prompt in code.

## Current Runtime Model

- execution is scoped to the active requirement
- module state is stored in `.phasegate/progress.json`
- `.phasegate/progress.md` is a generated read-only snapshot for humans; do not maintain it manually
- worker output is stored in `.phasegate/scratchpad/{module}/report.json`
- generated summaries live under `.phasegate/scratchpad/summaries/`
- do not write `.phasegate/progress.md`

## Coordinator Responsibilities

- derive execution waves from `.phasegate/tasks/*.md`
- inject only the current module task book, relevant contracts, and architecture constraints into each worker
- wait for each worker result before updating module state
- mark modules `done`, `failed`, or `blocked` in `progress.json`
- leave disposable coordination output under `scratchpad/`

## Completion

At the end of Phase 3, runtime code writes the execution summary and advances the phase.
The coordinator should not maintain a separate progress log.
