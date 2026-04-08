# Review And Acceptance

- Type: guide
- Status: active
- Reader: both

## Phase 4 Review

Phase 4 reviews only modules that completed successfully in Phase 3.

Primary inputs:

- `.phasegate/progress.json`
- `.phasegate/tasks/*.md`
- `.phasegate/contracts/*.md`
- `.phasegate/scratchpad/{module}/report.json`
- `.phasegate/scratchpad/summaries/phase-3-summary.md`

Gate behavior:

- the review output must produce a PASS verdict
- runtime persists `phase-4-summary.md` under `scratchpad/summaries/`

## Phase 5 Acceptance

Phase 5 verifies the active requirement's acceptance criteria and produces `acceptance-guide.md`.

Primary inputs:

- active requirement file
- `progress.json`
- worker reports
- phase summaries under `scratchpad/summaries/`

## Notes

- There is no `progress.md` review gate in the current model.
- Review and acceptance still require human judgment even when automated checks pass.

## Related

- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
- [progress-model.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/progress-model.md)
