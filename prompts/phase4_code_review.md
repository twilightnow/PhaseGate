# Phase 4: Lightweight Final Review Gate

## Goal

Perform a **lightweight final review** of the completed modules.
Your primary input is the **self-review bundle** produced by each worker in Phase 3.
You are NOT a second implementer; you are a final gate reviewer.

The CLI manages summaries and state transitions. Do not write `.phasegate/progress.md`.

## Input Priority

1. **Per-module review bundles** (report.json from each done module) — this is your primary input
2. **Task books** for done modules — verify bundle claims against task book acceptance criteria
3. **Phase 3 summary** — overview of module execution results
4. **Contracts** for public surface changes
5. **Changed source files** — only load selectively when a finding needs deeper inspection

If the review bundles are absent or incomplete, declare `"verdict": "rejected"` with finding:
"Insufficient review bundle from Phase 3 — re-run Phase 3 with complete self-review output."

## Review Focus

Focus your review on:

- **P0**: Are there any blockers that prevent acceptance? (security, data corruption, complete feature gap)
- **P1**: Are there significant issues that should be fixed before release?
- **P2**: Are there minor issues, style concerns, or suggestions?

Do NOT re-implement or re-trace every line of code. Trust the self-review bundle and spot-check key areas.

## Scope

Review only modules that are marked `done`. Skip modules marked `failed` or `blocked`.

## Fix Rules

- Fix every P0 issue before finishing when reasonable
- Fix P1/P2 issues when the change is low-risk
- Re-run relevant tests after fixes
- Do not review or modify failed/blocked modules unless a clearly related shared file requires it

## Output Format

After completing your review, output a JSON verdict block:

```json
{
  "verdict": "accepted",
  "reviewedBy": "phase4",
  "timestamp": "ISO-8601 timestamp",
  "findings": [
    {
      "level": "P0",
      "description": "Description of finding",
      "relatedModule": "module-name",
      "resolved": true
    }
  ],
  "residualRisks": ["any risks accepted and carried forward"],
  "confidenceLevel": "high"
}
```

`verdict` must be one of: `"accepted"`, `"conditional_pass"`, `"rejected"`.

After the JSON block, include a brief human-readable summary of:
- reviewed modules
- tests or validation commands run
- issues fixed
- remaining non-P0 issues
- modules skipped and why

If there are no done modules, return `"verdict": "accepted"` and state that nothing was reviewable.
