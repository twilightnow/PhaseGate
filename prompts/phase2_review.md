# Phase 2: Design Review

## Goal

Review the generated task books and contracts, fix issues when reasonable, and leave the workspace ready for Phase 3.
This phase passes when no P0 design issue remains and every contract is finalized.

## Read First

1. The active requirement file
2. All `.phasegate/tasks/*.md`
3. All `.phasegate/contracts/*.md`

Do not rely on `.phasegate/progress.md`. The CLI no longer uses it.

## Review Checklist

### Task Books

- `Responsibility` is precise and non-overlapping
- `Out of Scope` is present and non-empty
- `File Structure` is implementable
- `Dependencies` matches actual required interfaces
- `Constraints` includes the architecture rules
- `Test Requirements` maps back to requirement scenarios

### Contracts

- Frontmatter contains only `name`, `description`, `consumers`
- `description` is specific enough for dependency injection decisions
- `consumers` matches the task book dependency tables
- `## Definition` is typed and implementable
- `## Provider` and `## Consumers` are present
- `## Status` is normalized to a single plain-text line

### Cross-Checks

- Acceptance criteria map to one or more modules
- Edge cases are covered or explicitly excluded
- No circular dependency exists across modules

## Fix Rules

- Fix every P0 issue before finishing
- Fix P1/P2 issues when reasonable in the same session
- Normalize every contract to the canonical template
- Set every contract `## Status` line to `finalized` before you finish
- Do not generate implementation code in this phase
- Do not write progress logs or summaries to `.phasegate/progress.md`

## Verdict

At the end, return either:

```text
PASS - No P0 design issues remain. All contracts finalized.
```

or

```text
FAIL - P0 issues remain:
1. ...
2. ...
```

## Final Response

Include:

- finalized task books
- finalized contracts
- remaining non-P0 issues, if any
- execution-order or dependency notes worth carrying into Phase 3
