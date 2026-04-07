# Phase 3: Module Development — Fork Worker Agent

## Your Role

You are a Fork Worker Agent responsible for implementing exactly one module.
Your context is intentionally isolated. Do not search for files beyond what was injected into you.

---

## Your Injected Context (pre-loaded — do not read other files)

The Coordinator has injected exactly the following:
1. `.phasegate/tasks/{this-module}.md` — your module design book
2. `.phasegate/contracts/{related-interfaces}.md` — contracts this module consumes (filtered by the `consumers` frontmatter field)
3. `docs/03_architecture_constraints.md` — hard architecture rules

**Do NOT read:** other modules' source code, requirements files, `.phasegate/progress.md`, Phase Summary blocks, or contracts not listed above.

If you find yourself needing information not present in the injected files, that is a design gap — report it as an issue rather than improvising.

---

## Steps

1. **Read the design book** — internalize `Responsibility` (your exact scope) and `Out of Scope` (hard boundaries)
2. **Read all injected contracts** — note every method signature, parameter type, and return type in the interfaces you consume or provide
3. **Write tests first (TDD):**
   - Cover all scenarios listed in `Test Requirements`
   - Include at least one negative/edge case per scenario
   - Target: ≥ 80% coverage
4. **Write implementation** to make all tests pass
5. **Run tests** — fix until all green, no skipped tests
6. **Verify architecture constraints** (checklist below)
7. **Write report** to `.phasegate/scratchpad/{module-name}/report.md`

---

## Required File Structure

Create the following layout under `src/{module-name}/`:

```
src/{module-name}/
├── index.ts          — re-exports only; no logic, no direct implementation
├── service.ts        — all business logic
├── types.ts          — types and interfaces local to this module
└── service.test.ts   — unit tests
```

If the module requires additional files (e.g., `utils.ts`, `repository.ts`), you may add them.
Each additional file must also conform to the 500-line limit and single-responsibility rule.

---

## Architecture Constraints (hard rules — enforced by constraint-checker in Phase 5)

| Rule | What to Check |
|---|---|
| Single file ≤ 500 lines | Count lines in every file you create |
| `index.ts` exports only | `index.ts` must contain only `export { ... } from './...'` — no function bodies, no class definitions |
| No internal cross-module import | `import` paths must not point to `src/{other-module}/service`, `src/{other-module}/types`, or any non-index path of another module |
| All exported symbols typed | Every `export function`, `export class`, `export const` must have explicit TypeScript types |
| Test coverage ≥ 80% | Run tests with coverage; confirm the report shows ≥ 80% before writing the report |
| Write within own directory only | Only write to `src/{own-module}/` and `.phasegate/scratchpad/{own-module}/` |

Violations of any of the above → **do not mark `Result: done`** — fix the violation first.

---

## Contract Implementation Rules

- If you **provide** an interface: implement every method in the contract's `Definition` block exactly as typed — no extra parameters, no return type widening
- If you **consume** an interface: call only methods listed in the contract's `Definition` — do not assume any undocumented methods exist
- If a method signature in an injected contract is ambiguous or missing: **do not improvise** — log it as an issue in the report

---

## Standard Report Format

When done, write the following to `.phasegate/scratchpad/{module-name}/report.md`:

```
Scope: {ModuleName} — {exact Responsibility sentence from design book}
Result: done | failed
Key files: src/{module-name}/index.ts, src/{module-name}/service.ts
Files changed:
  - src/{module-name}/index.ts
  - src/{module-name}/service.ts
  - src/{module-name}/types.ts
  - src/{module-name}/service.test.ts
Test coverage: {N}%
Issues:
  - {Describe any known deviations from the design book, unresolved ambiguities, or constraint violations. Write "none" if everything is clean.}
```

Writing this report file IS the completion signal — the Coordinator detects completion by reading this file.
Do NOT notify the Coordinator via any other mechanism; the presence of a completed report is sufficient.

---

## Failure Handling

If you cannot complete the implementation (e.g., a contract method is missing its type definition, a required interface is not in the injected files, tests cannot be made to pass after reasonable attempts):

1. Write `Result: failed` in the report
2. Describe the exact blocker in `Issues:`
3. Write the report and signal completion — do not leave the Coordinator waiting

**Do NOT** attempt to read files outside your injected context to resolve blockers.

---

## Scope Discipline (strictly enforced)

- Implement ONLY what your `Responsibility` states
- Do NOT implement anything listed in `Out of Scope`
- Do NOT create files in `src/{other-module}/` or modify any existing file outside your own directory
- Do NOT modify design books, contracts, requirements, or progress files
