# M6 — Prompt Architecture Refactoring

- Module: M6
- Stage: 3（Prompt 重构）
- Status: draft
- Depends on: M4, M5
- Blocks: M7（文档章节关联），M8（end-to-end 测试需要新 prompt）

## Objective

1. **Phase 1 prompt**：内嵌设计自检约束（折叠 Phase 2 职责）
2. **Phase 3 worker prompt**：要求产出结构化 review bundle
3. **Phase 4 prompt**：改为轻量 final gate，输出 VerdictRecord JSON block
4. **Phase 2 prompt**：降级为 strict/debug 专用，不参与主流程
5. 所有 prompt 修改与 context loading 同步（prompt 要什么字段，executor 就注入什么）

---

## Target Files

| 文件 | 改动类型 |
|---|---|
| `prompts/phase1_design.md` | 增加设计自检约束节 |
| `prompts/phase1_design_zh.md` | 同步中文版 |
| `prompts/phase2_review.md` | 降级：增加 deprecated notice |
| `prompts/phase2_review_zh.md` | 同步中文版 |
| `prompts/phase3_worker.md` | 增加 review bundle 输出要求 |
| `prompts/phase3_worker_zh.md` | 同步中文版 |
| `prompts/phase4_code_review.md` | 改为轻量 gate，增加 VerdictRecord 输出格式 |
| `prompts/phase4_code_review_zh.md` | 同步中文版 |

---

## Detailed Changes

### 1. Phase 1 Prompt — 内嵌设计自检

在 Phase 1 prompt 现有结构后，增加一节：

```markdown
## Design Self-Check (Embedded — formerly Phase 2)

After generating task books and contracts, perform the following design self-check **before** writing the Phase 1 Summary.

### Checklist

1. **Responsibility uniqueness**: Does each module have a clearly distinct responsibility? Are there any overlapping or duplicated responsibilities across modules?
2. **Out-of-scope declaration**: Does each task book have an explicit `Out of Scope` section?
3. **Dependency-contract alignment**: For every inter-module dependency listed in a task book, is there a corresponding contract? Are contract consumers correctly listed?
4. **Requirements coverage**: Does the set of task books cover all acceptance criteria from the requirement document?
5. **Edge case capture**: Are important edge cases and failure modes reflected in the task books?
6. **Circular dependency check**: Do any modules have circular dependencies?

### Output: Design Risk Summary

Append the following section to the Phase 1 Summary file:

\`\`\`
## Design Risk Summary

### Review Focus
(list the top 2-3 areas that need careful attention during implementation)

### Known Design Risks
(list any risks identified during the self-check; write "none identified" if clean)

### Execution Wave Hints
(optional: rough ordering or parallelism hints for Phase 3 orchestration)
\`\`\`

If any critical issues are found during the self-check, **fix them before finalizing** the task books and contracts. Do not proceed to the Phase 1 Summary with unresolved critical design issues.
```

**中文版相应段落同步翻译。**

---

### 2. Phase 3 Worker Prompt — Review Bundle 输出要求

在现有实现指令末尾，增加：

```markdown
## Self-Review Bundle (Required)

After completing your implementation, you MUST produce a self-review bundle **before** writing your final report.

### Self-Review Steps

1. Run the test commands relevant to your module (unit tests, integration tests if applicable). Record the commands and results.
2. Compare your implementation against the task book: does it meet all acceptance criteria?
3. List any known gaps, edge cases not handled, or technical debt introduced.
4. List all files you changed, including test files.
5. State clearly if any public API, exported interface, or shared schema was modified.

### Report JSON — Required Fields

Your `report.json` MUST include all of the following fields:

\`\`\`json
{
  "scope": "<ModuleName> - <one-line responsibility>",
  "result": "done",
  "keyFiles": ["list of key implementation files"],
  "filesChanged": ["all files changed"],
  "issues": ["any blocking issues found"],

  "implementationSummary": "2-3 sentence description of what was implemented",
  "changedFiles": ["same as filesChanged — canonical field"],
  "testsRun": ["command1", "command2"],
  "testSummary": "X tests passed, Y failed. Coverage: Z%.",
  "selfReviewFindings": ["list of non-blocking findings or observations"],
  "knownRisks": ["list of risks or deferred issues"],
  "publicSurfaceChanged": false,
  "recommendedReviewScope": ["areas Phase 4 should focus on"]
}
\`\`\`

**Do not omit** `implementationSummary`, `changedFiles`, `testsRun`/`testSummary`, `selfReviewFindings`, and `knownRisks`. Phase 4 will treat a missing bundle as insufficient input.
```

---

### 3. Phase 4 Prompt — 改为轻量 Final Gate

Phase 4 prompt 完整重写核心部分，保留现有结构框架但改变审查机制：

```markdown
## Phase 4: Lightweight Final Review Gate

You are performing a **lightweight final review** of the completed modules.
Your primary input is the **self-review bundle** produced by each worker in Phase 3.
You are NOT a second implementer; you are a final gate reviewer.

### Input Priority

1. **Per-module review bundles** (report.json from each done module)
   — this is your primary input
2. **Task books** for done modules — verify bundle claims against task book acceptance criteria
3. **Phase 3 summary** — overview of module execution results
4. **Contracts** for public surface changes
5. **Changed source files** — only load selectively when a finding needs deeper inspection

If the review bundles are absent or incomplete, declare `"verdict": "rejected"` with finding:
"Insufficient review bundle from Phase 3 — re-run Phase 3 with complete self-review output."

### Review Focus

Focus your review on:
- **P0**: Are there any blockers that prevent acceptance? (security, data corruption, complete feature gap)
- **P1**: Are there significant issues that should be fixed before release?
- **P2**: Observations for future improvement (non-blocking)

Check:
- Task book acceptance criteria vs. implementation summary / test results
- Known risks from worker bundles — are they acceptable or blocking?
- Public surface changes — do contracts reflect the changes?
- Test coverage — does testSummary indicate adequate coverage?

### Output Format

**Required**: Write a JSON verdict block followed by a human-readable summary.

\`\`\`json
{
  "verdict": "accepted",
  "reviewedBy": "phase4",
  "timestamp": "<ISO date>",
  "findings": [
    { "level": "P0", "description": "...", "relatedModule": "...", "resolved": false }
  ],
  "residualRisks": ["list of accepted risks"],
  "confidenceLevel": "high"
}
\`\`\`

Then provide a prose `## Phase 4 Review Summary` explaining your reasoning.

### Gates

- If any `P0` finding has `"resolved": false` → reject. Stop. Ask for fixes before re-running.
- If all findings are `P1` or `P2` → conditional pass or accept at your discretion.
- If all clean → accept.
```

---

### 4. Phase 2 Prompt — 降级处理

在 Phase 2 prompt 文件最顶部加入 deprecated notice block：

```markdown
> **DEPRECATED — Phase 2 has been folded into Phase 1.**
>
> The design self-check constraints previously performed in this phase are now embedded
> in the Phase 1 "Design Generation" prompt. This file is retained as a strict/manual
> design review tool only.
>
> To use this prompt manually: `phasegate run --phase 2` will display a migration notice.
> This prompt can be invoked directly in a debug or strict-review context if needed.
>
> **Do not reference this phase in normal workflow documentation.**
```

---

## Prompt-Runtime Consistency Check

確保 prompt 要求的 context 字段与 M4 中 `buildPhase4ContextFiles` 实际注入的内容完全一致：

| Prompt 要求的输入 | M4 注入来源 |
|---|---|
| Per-module review bundles | `findWorkerReportFiles()` → `report.json` |
| Task books | `findDoneModuleTaskBooks()` |
| Phase 3 summary | `phase-3-summary.md` |
| Contracts (selective) | `findRelevantContracts()` |
| Requirement summary | `findActiveRequirementFile()` |

如果发现差异，**必须同步修改 M4 的 buildPhase4ContextFiles**，不允许 prompt 要求而 executor 未注入。

---

## Acceptance Criteria

- [ ] Phase 1 prompt 包含 Design Self-Check 节和 Design Risk Summary 输出模板
- [ ] Phase 3 worker prompt 包含 review bundle 必填字段说明
- [ ] Phase 4 prompt 包含 VerdictRecord JSON 输出格式规范
- [ ] Phase 4 prompt 明确声明 "you are NOT a second implementer"
- [ ] Phase 2 prompt 顶部包含 DEPRECATED notice
- [ ] 中文版 prompts 与英文版内容保持一致
- [ ] 用一个真实样本端到端验证：Phase 4 AI 输出包含合法 JSON verdict block

---

## Notes

- Prompt 改动不需要修改 `PHASE_META`（文件名不变）
- zh 和 en 两套 prompt 同步修改——不允许只改其中一套
- 如果现有 Phase 3 coordinator prompt 中已有关于 worker 指令的部分，也需要同步更新（检查 `prompts/phase3_coordinator.md`）
