# Phase 5: Acceptance

## Goal

Verify the active requirement against its acceptance criteria, run the most relevant automated checks you can in this repository, and return a concise acceptance report.

The CLI will generate `acceptance-guide.md`, summary artifacts, and final cleanup after this phase. Do not write `.phasegate/progress.md` yourself.

## Read First

Use the injected context first:

1. The active requirement file
2. `.phasegate/progress.json`
3. `.phasegate/scratchpad/summaries/*.md` when available
4. `.phasegate/scratchpad/*/report.json`
5. `docs/core/architecture-constraints.md` when available

## What To Verify

- extract acceptance criteria from the active requirement
- if explicit acceptance criteria cannot be found, treat that as a hard failure and say so clearly
- identify which criteria are auto-verifiable and which still need human confirmation
- review any failed or blocked modules noted in the injected summaries
- run the most relevant project validation commands available in the repo
- inspect implementation details when a criterion cannot be answered from command output alone
- focus on user-visible delivery, not just infrastructure readiness

## Automated Checks

Prefer repository-native commands first, such as:

- `npm test`
- package-specific test or build commands documented in the repo

If a command is missing, incompatible, or obviously unrelated, say so and use the next best check you can perform.

## Fix Rules

- If you find a small, local issue blocking acceptance, fix it when reasonable and re-run the affected check
- **Scope constraint**: Fixes must stay within files already created or modified in Phase 3. Do not create new files or introduce changes outside the existing implementation scope.
- If a problem is broader or risky, report it clearly instead of forcing a speculative fix
- Do not start a new requirement or redesign the workflow in this phase

## Final Response

Return a concise acceptance report that includes:

- overall verdict
- automated checks run and their results
- acceptance criteria that appear satisfied
- criteria that still require human verification
- criteria blocked by failed or missing implementation
- any escalations or known limitations

If the implementation improved infrastructure but the user-visible deliverable is still missing, report that as not accepted.

If acceptance is effectively complete from the AI side, say so explicitly so the CLI can finish the run cleanly.
