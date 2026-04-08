# Phase 1: Design Generation

## Goal

Generate the active requirement's design output with the smallest change set that can satisfy the requirement.
This phase runs non-interactively: finish the work, write the files, and return a short summary.

## Read First

1. The active requirement file injected from `.phasegate/requirements/`
2. `docs/core/architecture-constraints.md` if provided
3. The project `README.md` or `README` if it exists
4. The current `src/` layout if it helps you fit the design into the existing codebase

## Minimal Delivery Decision

Before writing any design file, decide whether the requirement is a minimal delivery task.
Treat the requirement as minimal delivery when it is primarily:

- content addition
- copy or text updates
- configuration adjustment
- static asset addition
- a small single-surface change that fits the existing structure

If minimal delivery applies:

- prefer one task book only
- do not invent extra modules just to make the work look more engineered
- do not create contracts unless cross-module coordination is truly required
- explain briefly why the existing structure can carry the change

Content additions, copy updates, config changes, and static asset work must not be auto-upgraded into module decomposition, contract extraction, or architecture cleanup.

## Required Outputs

Write these files only:

- `.phasegate/tasks/{module-name}.md`
- `.phasegate/contracts/{InterfaceName}.md` when a real cross-module contract is required

Do not write `.phasegate/progress.md` or any other progress log yourself. Runtime state is managed by the CLI.

## Design Book Template

````markdown
# {ModuleName}

## Responsibility
{one sentence describing exactly one concern}

## Out of Scope
- {things this module explicitly does not do}

## File Structure
src/{module-name}/
- index.ts
- service.ts
- types.ts

## Dependencies
| Interface | Direction |
|---|---|
| {InterfaceName} | CONSUMES |

## Constraints
- Max 500 lines per file
- No cross-module internal imports
- All exported symbols must be typed

## Test Requirements
- Coverage >= 80%
- Must cover: {key requirement scenarios}
````

## Contract Template

````markdown
---
name: {InterfaceName}
description: {specific interface purpose}
consumers:
  - {ModuleName}
---

# {InterfaceName}

## Status
draft

## Definition
```typescript
interface {InterfaceName} {
  method(param: Type): ReturnType;
}
```

## Provider
- {ModuleName}

## Consumers
- {ModuleName}

## Change Rule
Once finalized, changes require notifying all consumers and re-running Phase 2 review.
````

## Contract Rules

- Frontmatter keys must be exactly `name`, `description`, `consumers`
- Do not add extra frontmatter keys
- `## Status` must be the single line `draft`
- Keep `## Provider`, `## Consumers`, and `## Change Rule` as body sections

## Completion Checklist

- Every required module has a task book in `.phasegate/tasks/`
- Every cross-module interface has a contract in `.phasegate/contracts/`
- Each contract frontmatter has a meaningful `description`
- Each contract frontmatter lists the correct `consumers`
- If this is minimal delivery, the output must stay minimal and explain why contracts were unnecessary

## Design Self-Check (Embedded)

After generating task books and contracts, perform the following design self-check **before** writing the Phase 1 Summary.

### Checklist

1. **Responsibility uniqueness**: Does each module have a clearly distinct responsibility? Are there any overlapping or duplicated responsibilities across modules?
2. **Out-of-scope declaration**: Does each task book have an explicit `Out of Scope` section?
3. **Dependency-contract alignment**: For every inter-module dependency listed in a task book, is there a corresponding contract? Are contract consumers correctly listed?
4. **Requirements coverage**: Does the set of task books cover all acceptance criteria from the requirement document?
5. **Edge case capture**: Are important edge cases and failure modes reflected in the task books?
6. **Circular dependency check**: Do any modules have circular dependencies?

If any critical issues are found during the self-check, **fix them before finalizing** the task books and contracts. Do not proceed to the Phase 1 Summary with unresolved critical design issues.

## Final Response

Return a short summary with:

- whether Minimal Delivery Mode was used
- modules created
- contracts created
- any assumptions made

Then append:

```
## Design Risk Summary

### Review Focus
(list the top 2-3 areas that need careful attention during implementation)

### Known Design Risks
(list any risks identified during the self-check; write "none identified" if clean)

### Execution Wave Hints
(optional: rough ordering or parallelism hints for Phase 3 orchestration)
```
