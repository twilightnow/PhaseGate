# PhaseGate CLI Surface

- Type: core
- Status: active
- Reader: both
- Use when: you need command-level behavior

## Commands

- `phasegate init`
  - Creates `.phasegate/`
  - Creates `requirements/`, `tasks/`, `contracts/`, `scratchpad/`, `archive/`
  - Writes `progress.json` and `phasegate.config.json`
- `phasegate chat`
  - Runs Phase 0 requirement discussion
  - Approves requirement docs after the Phase 0 gate passes
- `phasegate select <requirement>`
  - Selects one approved requirement for execution
- `phasegate run`
  - Executes the active requirement from the current phase
  - `--requirement <name>` selects and runs in one command
  - `--phase <n>` forces a specific phase
- `phasegate status`
  - Prints a readable execution overview from `progress.json`
- `phasegate progress`
  - Prints the raw structured `progress.json` state
- `phasegate review <module>`
  - Runs focused review for a specific module

## Notes

- `progress.json` is the only state authority.
- There is no CLI command that displays or maintains `progress.md`.
- Phase 3 uses the orchestrator directly; other phases use prompt-based execution.

## Related

- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
- [getting-started.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/guides/getting-started.md)
- [index.ts](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/index.ts)
