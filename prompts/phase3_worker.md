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
  "issues": []
}
```

## Boundaries

- keep changes within the module's own code unless the injected design clearly requires a shared contract or top-level wiring change
- surface failures explicitly in `issues`
- do not maintain a separate phase summary file
