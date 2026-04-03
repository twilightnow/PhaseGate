# Phase 1: Design Book Generation

## Your Task

Generate module design books and interface contracts for a PhaseGate project.
This runs non-interactively — complete all tasks, write all files, then output a Phase 1 Summary.

---

## Inputs to Read First

Before generating anything, read the following:

1. All files in `.phasegate/requirements/` — the confirmed requirements
2. `.phasegate/progress.md` — current project state (already injected as context)
3. `docs/03_architecture_constraints.md` — architecture rules (already injected as context)
4. Scan the project's `src/` directory structure to understand existing layout

---

## Steps

1. Parse all requirements files. Identify the distinct modules needed.
2. For each module, create `.phasegate/design/{module-name}.md` using the Module Design Book Template below.
3. Identify every cross-module interface. For each, create `.phasegate/contracts/{InterfaceName}.md` using the Contract Template below.
4. Append a Phase 1 Summary block to `.phasegate/progress.md`.

---

## Module Design Book Template

```markdown
# {ModuleName}

## Responsibility
{one sentence: what this module does and nothing else}

## Out of Scope
- {things this module explicitly does NOT do}

## File Structure
src/{module-name}/
├── index.ts      # public exports only, no logic
├── service.ts    # business logic
└── types.ts      # types local to this module

## Dependencies
| Interface | Direction |
|---|---|
| {InterfaceName} | CONSUMES |

## Constraints
- Max 500 lines per file
- No direct import of other modules' internal files
- All exported symbols must be typed

## Test Requirements
- Coverage ≥ 80%
- Must cover: {list key scenarios from requirements}
```

---

## Interface Contract Template

```markdown
---
name: {InterfaceName}
description: {one sentence describing this interface's purpose — must be semantically specific enough for the orchestrator to decide which modules need it}
consumers:
  - {ModuleName}
---

# {InterfaceName}

## Status
draft

## Definition
\`\`\`typescript
interface {InterfaceName} {
  method(param: Type): ReturnType;
}
\`\`\`

## Provider
- {ModuleName}

## Consumers
- {ModuleName}

## Change Rule
Once finalized, changes require notifying all Consumers and re-running Phase 2 review.
```

---

## Phase 1 Summary Format

Append this block to `.phasegate/progress.md`:

```markdown
## Phase 1 Summary

### Current State
Generated design books: .phasegate/design/module-a.md, ...
Generated contracts: .phasegate/contracts/IFoo.md, ...

### Key Decisions
- {key design decisions made}

### Outputs
- .phasegate/design/: {N} module design books
- .phasegate/contracts/: {N} interface contracts

### Notes for Phase 2
- {things to focus on during review}
```

---

## Gate Conditions (verify before finishing)

- [ ] Every identified module has a `.phasegate/design/{module-name}.md`
- [ ] Every cross-module interface has a `.phasegate/contracts/{InterfaceName}.md` with frontmatter
- [ ] The `consumers` field in each contract frontmatter is filled
- [ ] Phase 1 Summary has been appended to `.phasegate/progress.md`
