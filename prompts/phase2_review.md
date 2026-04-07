# Phase 2: Design Book Review

## Your Task

Perform a two-pass review of all module design books and interface contracts generated in Phase 1.
This runs non-interactively — complete both passes, fix issues when reasonable, and allow Phase 2 to pass as long as no P0 issue remains.

---

## Inputs to Read First

### For Pass 1 (AI Self-Check — Against Requirements)
1. `.phasegate/progress.md` — confirm current phase is PHASE_2; load **Phase 1 Summary** block as context anchor
2. `.phasegate/requirements/*.md` — all confirmed requirements (Scope, Acceptance Criteria, Edge Cases)
3. `.phasegate/tasks/*.md` — all module design books
4. `.phasegate/contracts/*.md` — all interface contracts

### For Pass 2 (Independent Review — Blank Context)
Load **only** the following. Do NOT load requirements, progress, or phase summaries:
1. `.phasegate/tasks/*.md`
2. `.phasegate/contracts/*.md`

---

## Pass 1: AI Self-Check

Work through every design book and contract in sequence. Check each item below.

### Module Design Books (`.phasegate/tasks/*.md`)
- [ ] `Responsibility` is a single sentence describing exactly one concern
- [ ] `Out of Scope` is present and non-empty
- [ ] No two modules share overlapping responsibilities
- [ ] `File Structure` lists `index.ts` (exports only), `service.ts` (logic), `types.ts` (local types)
- [ ] Every interface in `Dependencies` table has a matching contract in `.phasegate/contracts/`
- [ ] `Constraints` references 500-line limit, no internal cross-module import, typed exports
- [ ] `Test Requirements` specifies coverage ≥ 80% and lists key scenarios matching requirements

### Interface Contracts (`.phasegate/contracts/*.md`)
- [ ] Every contract file contains YAML frontmatter with `name`, `description`, `consumers` fields
- [ ] `description` is semantically specific enough for an orchestrator to decide which modules need it
- [ ] `consumers` matches the `Dependencies` tables across all design books (no mismatch)
- [ ] `Provider` module is named
- [ ] `Definition` block contains a valid, fully-typed TypeScript interface
- [ ] `Status` is `draft`
- [ ] `Change Rule` section is present
- [ ] If a contract arrived in any non-canonical format, normalize it to the canonical PhaseGate contract template before finishing Pass 1

### Cross-Validation (Requirements ↔ Design)
- [ ] Every acceptance criterion in requirements maps to at least one module's `Responsibility`
- [ ] Every edge case in requirements is handled by some module's `Responsibility` or explicitly excluded in `Out of Scope`
- [ ] No circular dependency exists: trace every `Dependencies` chain, confirm no A → B → … → A cycle

---

## Pass 2: Independent Review

Read only `.phasegate/tasks/*.md` and `.phasegate/contracts/*.md`. No other context.

Pass 2 is confirm-first, but it is NOT read-only. If Pass 2 reveals remaining issues, you should fix them in the corresponding design book or contract when reasonable, then re-check the affected items. Only unresolved P0 issues block Phase 2 from passing.

For each module design book, answer:
1. Can this module be implemented without any knowledge beyond the design book and injected contracts?
2. Is every method signature in consumed contracts self-explanatory from the contract definition alone?
3. Would adding a new Consumer to a contract break existing Consumers?
4. Are there implicit runtime dependencies not listed in the `Dependencies` table?

---

## Verdict

Immediately after both passes, classify every issue by severity:

- `P0`: cannot proceed to Phase 3 safely; must be fixed before PASS
- `P1`: important quality/correctness issue; should be fixed if reasonable in this session, but does not block progression by itself
- `P2`: minor clarity or maintainability issue; record it and proceed

Then output one of the following:

```
PASS — Both review passes completed. No P0 issues remain.
```

or

```
FAIL — P0 issues found:
  1. [Pass 1 | P0 | tasks/module-a.md] Missing `Out of Scope` section
  2. [Pass 1 | P0 | contracts/IFoo.md] `consumers` lists moduleB but tasks/module-b.md has no matching dependency
  3. [Pass 2 | P0 | tasks/module-c.md] Cannot implement without implicit knowledge of module-a's schema
  ...
```

---

## If FAIL: Fix and Re-check

1. Fix each P0 issue in the corresponding `.phasegate/tasks/` or `.phasegate/contracts/` file.
2. Also fix P1/P2 issues when reasonable in the current session; if not fixed, record them in the summary.
3. Re-check only the items that were violated. Do not re-run the full checklist unless a fix has ripple effects.
4. This applies to issues found in either Pass 1 or Pass 2. Pass 2 findings must also be corrected when reasonable, not merely reported.
5. Repeat until no P0 issue remains and verdict is PASS.

---

## Output (on PASS)

1. Normalize every `.phasegate/contracts/*.md` file to the canonical PhaseGate template before finalizing:
   - frontmatter keys must be exactly `name`, `description`, `consumers`
   - remove extra frontmatter keys such as `status`, `version`, `provider`, or `providers`
   - `## Status` must be a single plain-text line
   - `## Provider`, `## Consumers`, and `## Change Rule` must remain markdown body sections
2. Set `Status` to the exact single line `finalized` in every `.phasegate/contracts/*.md` file (replace `draft` or any other prior status representation).
3. Append Phase 2 Summary to `.phasegate/progress.md`:

```markdown
## Phase 2 Summary

### Current State
Design review passed. All module responsibilities are unambiguous, contracts are complete, no circular dependencies found.

### Issues Fixed
- {brief description of each blocking issue found and how it was resolved, or "none"}

### Remaining Non-P0 Issues
- {P1/P2 issues intentionally left for later, or "none"}

### Outputs
- All .phasegate/tasks/*.md finalized
- All .phasegate/contracts/*.md finalized (Status: finalized)

### Notes for Phase 3
- {execution wave order hints, e.g. "module-c depends on module-a — must be developed in wave 1"}
- {any special constraints the Coordinator should respect}
```

---

## Gate Check (confirm before ending session)

- [ ] Pass 1 checklist: zero P0 issues remaining across all design books and contracts
- [ ] Pass 2 checklist: zero P0 issues remaining across all design books
- [ ] All `.phasegate/contracts/*.md` use the canonical template and have `## Status` followed by the exact single line `finalized`
- [ ] Phase 2 Summary appended to `.phasegate/progress.md`

---

## Termination Behavior (strictly enforced)

Once the gate check passes:
- Report the list of finalized design books and contracts
- `phasegate run` will automatically detect that all contracts are finalized, advance to Phase 3, and continue in the same CLI session unless the user explicitly ran `phasegate run --phase 2`
- **Do NOT** generate any code, scaffolding, or implementation stubs
- **Do NOT** ask "should I start building?" or any similar prompt
- Return control to the user and wait for their next instruction
