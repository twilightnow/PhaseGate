# Phase 5: Acceptance

## Your Task

Verify that the project meets all acceptance criteria defined in Phase 0.
This phase has two sub-stages: AI auto-verification (5A) runs fully automatically; human verification guide (5B) is generated for the user to complete manually.

---

## Inputs to Read First

1. `.phasegate/requirements/*.md` — extract every `Acceptance Criteria` checklist item
2. `.phasegate/progress.md` — load **Phase 3 Summary** and **Phase 4 Summary** blocks as context anchors; identify which modules are `done` vs. `failed`/`blocked`
3. `.phasegate/scratchpad/*/report.md` — worker reports for all done modules (coverage, known issues)

---

## Phase 5A: AI Auto-Verification

### Step 1: Classify Acceptance Criteria

Parse every acceptance criterion from `.phasegate/requirements/*.md`.
Label each as **auto-verifiable** or **human-required**:

| Auto-verifiable | Human-required |
|---|---|
| Functional: output matches expected value for a given input | UX: user experience, visual judgment |
| Error handling: correct error code / message returned | Subjective quality: "message is clear", "flow feels natural" |
| Coverage: test coverage ≥ threshold | Third-party integration: live external service calls |
| Constraint: no circular deps, ≤ 500 lines | Performance under real load (if not covered by automated benchmarks) |
| All unit tests pass | Business approval: sign-off by a person |

Produce a classified list before running any checks:

```
Auto-verifiable:
  [AC-01] All unit tests pass
  [AC-03] Returns 404 when resource not found
  ...

Human-required:
  [AC-02] Error messages are user-friendly
  [AC-05] Works correctly on mobile screen
  ...
```

If `failed`/`blocked` modules exist, note which acceptance criteria cannot be verified because of them.

---

### Step 2: Run Automated Checks (in order)

Execute each of the following. Stop and enter the self-correction loop immediately if a step fails.

**2-A. Run all module tests**
```
npm test
```
- All `done` modules must have 100% tests passing (zero failures, zero skips)
- Coverage ≥ 80% per module

**2-B. Run constraint-checker**
```
phasegate status
```
Zero violations expected:
- [ ] No file > 500 lines
- [ ] No circular dependencies
- [ ] No cross-module internal imports
- [ ] All exported symbols typed

**2-C. Verify auto-verifiable acceptance criteria**
For each auto-verifiable criterion, execute the corresponding test or verification command and confirm it passes.

---

### Step 3: Self-Correction Loop (triggered on any failure in Step 2)

```
1. Identify the failing module from the test/constraint output
2. Re-fork that module's worker agent using phase3_worker.md as the system prompt, injecting:
     - .phasegate/tasks/{module}.md
     - Relevant contracts (from consumers frontmatter)
     - docs/03_architecture_constraints.md
     - Failure description: exact test output or constraint violation report (append to injected context)
3. Worker fixes the issue and re-submits report to .phasegate/scratchpad/{module-name}/report.md
4. Re-run the specific check that failed
5. PASS → continue with remaining checks
   FAIL (attempt 2) → retry once more with additional failure context
   FAIL (attempt 3) → escalate: pause Phase 5A, report to user with full failure record
```

Maximum 3 self-correction attempts per module. On third failure, do not attempt further corrections — escalate unconditionally.

---

### Step 4: Phase 5A Verification Report

Output the following before proceeding to Phase 5B:

```
Phase 5A Auto-Verification Results
===================================
[PASS] All unit tests pass (N test cases across M done modules)
[PASS] Architecture constraints: 0 violations
[PASS] AC-01: {criterion text}
[PASS] AC-03: {criterion text}
[SKIP] AC-06: {criterion text} — cannot verify; module-x failed in Phase 3
[ESCALATED] AC-04: {criterion text} — self-correction failed after 3 attempts; manual review required

Summary: N/M auto-verifiable criteria passed, K skipped, J escalated
```

If any criteria were escalated, include escalation notes in the acceptance guide in Phase 5B.

---

## Phase 5B: Generate Human Verification Guide

Proceed here only after Phase 5A is fully complete (all checks done — pass, skip, or escalated).

Generate `acceptance-guide.md` in the project root:

```markdown
# {project-name} Acceptance Guide

Generated: {date}
Phase: 5B — Human Verification

## AI Auto-Verification Summary
- [x] All unit tests passing ({N} test cases, {M} modules)
- [x] Architecture constraint check: 0 violations
- [x] {each passed auto-verifiable acceptance criterion}
- [ ] {each escalated or skipped criterion — annotated with reason}

## Items Requiring Human Verification

### {N}. {criterion text from requirements}
**How to verify:**
{numbered step-by-step instructions for a human to perform}

**Expected result:**
{what the verifier should observe if the implementation is correct}

**Pass condition:**
{the specific, unambiguous thing that makes this criterion pass}

---

## Modules Not Covered

The following modules failed or were blocked in Phase 3 and are NOT included in this guide:

| Module | Status | Reason |
|---|---|---|
| module-x | failed | {reason from Phase 3 Summary} |
| module-y | blocked | downstream of module-x |

Acceptance criteria that depend on these modules should be re-evaluated after those modules are fixed.

---

## Escalated Items (require human + AI investigation)

| Criterion | Failure summary | Self-correction attempts |
|---|---|---|
| AC-04 | {description} | 3 (all failed) |
```

---

## After Human Verification (next AI session)

The user will report results. Handle as follows:

| Outcome | Action |
|---|---|
| All items pass | Append Phase 5 Summary with `PHASE_DONE` to `progress.md` |
| Bug found | Re-fork the relevant module worker (same self-correction loop as Phase 5A); re-run test and constraint checks for that module; re-verify affected human criteria after fix |
| Design problem found | Create `.phasegate/requirements/{fix-name}.md`; do NOT rollback existing work; run Phase 1→2→3 only for affected modules; after those phases complete, return to Phase 5 and re-run all checks for the affected modules |

---

## Phase 5 Summary (write when all verification complete)

Append to `.phasegate/progress.md`:

```markdown
## Phase 5 Summary

### Current State
PHASE_DONE

### Auto-Verification
Passed: {N} criteria automatically verified
Skipped: {K} criteria (modules failed/blocked in Phase 3)
Escalated: {J} criteria (self-correction failed; see acceptance-guide.md)

### Human Verification
All {M} human-verifiable criteria confirmed by user on {date}.

### Known Limitations
- {any failed/blocked modules, what acceptance criteria they affect, and recommended follow-up action}
```

---

## Gate Check

### Gate 5A — Check before generating acceptance guide (end of first session)
- [ ] All automated checks completed: every item is PASS, SKIP, or ESCALATED — nothing left pending
- [ ] Architecture constraint-checker: 0 violations for all done modules
- [ ] Phase 5A Verification Report output to user
- [ ] `acceptance-guide.md` generated in project root

### Gate 5B — Check after human verification results are received (second session)
- [ ] Human has confirmed all verifiable items in the acceptance guide
- [ ] Any bugs found during human verification have been fixed and re-verified
- [ ] Phase 5 Summary with `PHASE_DONE` appended to `.phasegate/progress.md`

---

## Termination Behavior (strictly enforced)

### After Phase 5B generates acceptance-guide.md (first session end)
- Inform the user that all auto-verifiable checks have completed
- Provide the path to `acceptance-guide.md`
- Instruct the user to complete human verification against the guide
- **Do NOT** ask "shall I proceed with anything else?"
- Return control to the user and wait for their verification results

### After receiving human verification results (second session end)
- Confirm to the user that the project has completed all phases
- Report any known limitations (failed/blocked modules)
- **Do NOT** start new features or suggest next steps beyond what was in the original requirements
- Return control to the user
