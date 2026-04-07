# Phase 4: Code Review

## Your Task

Perform a two-pass code review for all modules that completed successfully in Phase 3.
This runs non-interactively — complete both passes, fix issues when reasonable, run tests to confirm no regressions, and allow Phase 4 to pass as long as no P0 issue remains.

---

## Determine Review Scope First

1. Read `.phasegate/progress.md` — load **Phase 3 Summary** block; extract the list of `done` modules
2. Modules listed as `failed` or `blocked` are out of scope — skip them entirely
3. If there are zero `done` modules, there is nothing to review; write the Phase 4 Summary noting that fact, then terminate

---

## Inputs to Load Per Module

### For Pass 1 (Design Conformance)
For each `done` module:
- `.phasegate/tasks/{module}.md` — design book
- `.phasegate/contracts/*.md` — all contracts this module provides or consumes (check `consumers` frontmatter)
- `src/{module-name}/` — all source files (index, service, types, tests)
- `.phasegate/scratchpad/{module-name}/report.md` — [optional] worker's self-reported issues

### For Pass 2 (Independent Readability)
For each `done` module — load ONLY these:
- `.phasegate/tasks/{module}.md` — design book
- `src/{module-name}/` — all source files

Do NOT load contracts, progress history, or Phase Summaries for Pass 2.

---

## Pass 1: Design Conformance Review

Run the following checklist for each `done` module independently.

### Responsibility & Scope
- [ ] Implementation does only what `Responsibility` states — nothing more
- [ ] Implementation does NOT do anything listed in `Out of Scope`

### Architecture Constraints
- [ ] Every source file has ≤ 500 lines (count manually per file)
- [ ] `index.ts` contains only re-exports (`export { ... } from './...'`) — no function bodies, no class definitions
- [ ] No `import` path points to another module's internal file (e.g., `../other-module/service` is a violation; `../other-module` or `../other-module/index` is allowed)
- [ ] All exported symbols have explicit TypeScript types (no implicit `any`, no untyped exports)

### Contract Conformance
- [ ] Every method in a consumed contract is called with the correct signature and parameter types
- [ ] Every method in a provided contract is fully implemented with the correct signature and return type
- [ ] No extra methods are exported via `index.ts` that are not declared in any contract (undocumented public API)

### Test Quality
- [ ] Test coverage ≥ 80% (run tests with coverage and confirm the report)
- [ ] All scenarios listed in the design book's `Test Requirements` have at least one test case
- [ ] Tests cover at least one negative/edge case per scenario — not only the happy path
- [ ] No tests are skipped or have empty assertions

---

## Pass 2: Independent Readability Review

Pretend you have never seen the requirements or design history. Read only the design book and the implementation.

Pass 2 is confirm-first, but it is NOT read-only. If Pass 2 reveals remaining issues, you should fix the corresponding source files when reasonable, re-run the necessary tests, and re-check the affected review items. Only unresolved P0 issues block Phase 4 from passing.

For each module, answer:
1. Is the code's intent understandable by reading it, without consulting any external document?
2. Are there any hidden side effects or mutations to shared/global state?
3. Are all error paths handled explicitly? (No silent `catch` blocks, no swallowed exceptions)
4. If a new developer adds a feature to this module next month, which files will they need to modify — and is that a reasonable change surface?

Flag any answer that reveals a readability or maintainability problem, and classify it as P0, P1, or P2.

---

## Verdict

After completing both passes, classify every issue by severity:

- `P0`: cannot proceed to Phase 5 safely; must be fixed before PASS
- `P1`: important quality/correctness issue; should be fixed if reasonable in this session, but does not block progression by itself
- `P2`: minor clarity or maintainability issue; record it and proceed

Then output immediately:

```
PASS — Both review passes completed. No P0 issues remain across reviewed modules.
```

or

```
FAIL — P0 issues found:
  1. [Pass 1 | P0 | module-a/service.ts] File has 523 lines (exceeds 500-line limit)
  2. [Pass 1 | P0 | module-b/service.ts:L88] Imports '../other-module/service' directly (internal import violation)
  3. [Pass 1 | P0 | module-c] Test coverage 71% (below 80% threshold)
  4. [Pass 2 | P0 | module-d/service.ts:L44] Error from external call is silently caught with empty catch block
  ...
```

---

## If FAIL: Fix and Re-check

1. Fix each P0 issue in the corresponding source file.
2. Also fix P1/P2 issues when reasonable in the current session; if not fixed, record them in the summary.
3. Re-run tests after each fix to confirm no regressions.
4. Re-check the specific checklist items that were violated — confirm they now pass.
5. This applies to issues found in either Pass 1 or Pass 2. Pass 2 findings should also be corrected when reasonable, not merely reported.
6. Repeat until no P0 issue remains and verdict is PASS.

---

## Output (on PASS)

Append Phase 4 Summary to `.phasegate/progress.md`:

```markdown
## Phase 4 Summary

### Current State
Code review passed. All done-module implementations conform to their design books. No architecture constraint violations found.

### Coverage
- {module-name}: {N}% coverage
- ...

### Issues Fixed
- {brief description of each blocking issue found and how it was resolved, or "none"}

### Remaining Non-P0 Issues
- {P1/P2 issues intentionally left for later, or "none"}

### Modules Skipped (not reviewed)
- {module-name}: failed in Phase 3 — {reason from Phase 3 Summary}
- {module-name}: blocked in Phase 3 — {reason}

### Notes for Phase 5
- {specific acceptance criteria that may need extra manual attention}
- {any known technical debt or edge cases the acceptance reviewer should probe}
```

---

## Gate Check (confirm before ending session)

- [ ] Pass 1 checklist: zero P0 issues across all done modules
- [ ] Pass 2 checklist: zero P0 issues across all done modules
- [ ] All tests pass after fixes (run full test suite; confirm zero test failures)
- [ ] Phase 4 Summary appended to `.phasegate/progress.md`

---

## Termination Behavior (strictly enforced)

Once the gate check passes:
- Report which modules passed review and which were skipped (failed/blocked)
- `phasegate run` will automatically detect the Phase 4 Summary in progress.md, advance to Phase 5, and continue in the same CLI session unless the user explicitly ran `phasegate run --phase 4`
- **Do NOT** begin acceptance testing, generate an acceptance guide, or run constraint-checker for Phase 5
- Return control to the user and wait for their next instruction
