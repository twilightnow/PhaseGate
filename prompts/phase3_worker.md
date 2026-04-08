# Phase 3: Worker Reference

This file is reference guidance only. The current orchestrator builds its worker prompt in code.

## Current Runtime Model

- read only the injected task book, relevant contracts, and architecture constraints
- do not read unrelated modules or requirement backlog files unless explicitly re-injected
- do not read or write `.phasegate/progress.md`
- write the final worker output to `.phasegate/scratchpad/{module}/report.json`

## Worker Report Shape

The runtime expects a structured worker report equivalent to:

```json
{
  "scope": "module-name - one-line responsibility",
  "result": "done",
  "keyFiles": ["src/module-name/index.ts"],
  "filesChanged": ["src/module-name/index.ts"],
  "issues": [],

  "implementationSummary": "2-3 sentence description of what was implemented",
  "changedFiles": ["src/module-name/index.ts"],
  "testsRun": ["npm test -- src/module-name"],
  "testSummary": "X tests passed, 0 failed.",
  "selfReviewFindings": [],
  "knownRisks": [],
  "publicSurfaceChanged": false,
  "recommendedReviewScope": []
}
```

## Self-Review Bundle (Required)

After completing implementation, produce a self-review bundle **before** writing the final report:

1. Run the test commands relevant to your module. Record commands and results.
2. Compare implementation against the task book: does it meet all acceptance criteria?
3. List any known gaps, edge cases not handled, or technical debt introduced.
4. List all files changed, including test files.
5. State clearly if any public API, exported interface, or shared schema was modified.

Do not omit `implementationSummary`, `changedFiles`, `testsRun`/`testSummary`, `selfReviewFindings`, and `knownRisks`. Phase 4 will treat a missing bundle as insufficient input.

## Boundaries

- keep changes within the module's own code unless the injected design clearly requires a shared contract or top-level wiring change
- surface failures explicitly in `issues`
- do not maintain a separate phase summary file
