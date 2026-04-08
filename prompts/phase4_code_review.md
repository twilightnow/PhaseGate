# Phase 4: Code Review

## Goal

Review the implementation for modules that completed successfully in Phase 3, fix P0 issues when reasonable, run relevant tests, and return a clear PASS or FAIL verdict.

The CLI manages summaries and state transitions. Do not write `.phasegate/progress.md`.

## Determine Scope

Use the injected context first:

- `.phasegate/progress.json`
- `.phasegate/scratchpad/summaries/phase-3-summary.md` when available
- `.phasegate/scratchpad/*/report.json`
- `.phasegate/tasks/*.md`
- `.phasegate/contracts/*.md`

Review only modules that are marked `done`. Skip modules marked `failed` or `blocked`.

## Review Passes

### Pass 1: Design Conformance

For each done module, compare implementation against its task book and contracts.

Check:

- implementation matches `Responsibility`
- implementation respects `Out of Scope`
- no file exceeds 500 lines
- no cross-module internal imports
- exported symbols are typed
- contract usage and provided APIs match signatures
- tests cover required scenarios
- no skipped or empty tests hide regressions

### Pass 2: Readability and Maintainability

Read the code as if design history did not exist.

Check:

- intent is understandable from the code
- side effects are explicit
- errors are handled intentionally
- change surface is reasonable for future work

## Fix Rules

- Fix every P0 issue before finishing when reasonable
- Fix P1/P2 issues when the change is low-risk
- Re-run relevant tests after fixes
- Do not review or modify failed/blocked modules unless a clearly related shared file requires it

## Verdict

Return one of these exact leading lines:

```text
PASS
```

or

```text
FAIL
```

After the verdict, include a concise review report with:

- reviewed modules
- tests or validation commands run
- issues fixed
- remaining non-P0 issues
- modules skipped and why

If there are no done modules, return `PASS` and state that nothing was reviewable.
