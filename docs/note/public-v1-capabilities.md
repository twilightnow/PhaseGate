# Public V1 Capabilities

- Type: note
- Status: historical
- Reader: both

## Purpose

This note records a historical capability checkpoint for an earlier public-v1 target.
It is not the current source of truth.

## Historical Capability Themes

1. stable local setup and basic CLI flows
2. reliable `init`, `chat`, `run`, `status`, `progress`, and `review`
3. persisted project artifacts under `.phasegate/`
4. resumable execution state
5. Phase 3 coordinator and worker orchestration
6. configurable AI routing
7. baseline documentation

## Important Drift Since This Note

- `progress.json` is still the only authoritative state file
- the current implementation no longer maintains `.phasegate/progress.md`
- active execution is explicitly scoped by `activeRequirement`
- phase summaries now live under `.phasegate/scratchpad/summaries/`

## Use Current Docs For

- actual workspace layout
- actual CLI behavior
- actual progress semantics
