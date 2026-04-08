# M9 — Documentation Update

- Module: M9
- Stage: 4（CLI、测试、文档收尾）
- Status: draft
- Depends on: M6, M7
- Blocks: 无

## Objective

确保所有用户可见的文档与新架构保持一致，不出现"双重 review"等旧叙述。

---

## Target Files

| 文件 | 改动优先级 | 改动类型 |
|---|---|---|
| `docs/core/workflow-phases.md` | 高 | Phase 2 折叠说明；Phase 4 改为轻量 gate |
| `docs/core/overview.md` | 高 | 工作流说明更新 |
| `docs/core/ai-routing.md` | 中 | Phase 2 routing key 标注为 deprecated |
| `docs/core/progress-model.md` | 高 | phaseStates、VerdictRecord 字段说明；Phase 2 迁移逻辑 |
| `docs/core/cli-surface.md` | 中 | run / review 命令语义更新 |
| `docs/guides/getting-started.md` | 高 | 默认工作流路径更新 |
| `docs/guides/review-and-acceptance.md` | 高 | 轻量 review 说明；Phase 3 bundle 说明 |
| `README.md` | 高 | Status 章节、Workflow Direction 章节 |
| `README.zh-CN.md` | 中 | 与英文版保持同步 |
| `README.ja.md` | 中 | 与英文版保持同步 |
| `docs/README.md` | 低 | 快速索引链接不失效 |

---

## Detailed Changes

### 1. docs/core/workflow-phases.md

删除：
- Phase 2 作为独立 design review phase 的完整描述
- "two-pass design review" 相关叙述

新增：
- Phase 1 中"Embedded Design Self-Check"章节说明
- Phase 4 重新定义为"Lightweight Final Review Gate"
- 新增"Phase 2 Migration Note"提示框：

```markdown
> **Note**: Phase 2 (Design Review) has been folded into Phase 1.
> Design self-check constraints are now embedded in the Phase 1 prompt.
> If you have an existing workspace at Phase 2, running `phasegate run` will
> automatically advance you to Phase 3 with a migration notice.
```

更新工作流图示：

```
Phase 0: Requirements
Phase 1: Design Generation + Embedded Self-Check
Phase 3: Parallel Module Development + Self-Review Bundle
Phase 4: Lightweight Final Review Gate
Phase 5: Acceptance
```

---

### 2. docs/core/progress-model.md

增加新字段说明：

```markdown
## New Fields (v1.1+)

### phase4Verdict

Type: `VerdictRecord | undefined`

Stores the structured review verdict from Phase 4. Fields:
- `verdict`: `"accepted" | "conditional_pass" | "rejected"`
- `findings`: list of P0/P1/P2 findings with resolution status
- `residualRisks`: list of accepted risks carried forward
- `confidenceLevel`: `"high" | "medium" | "low"`

### phaseStates

Type: `PhaseStateEntry[] | undefined`

Explicit state machine entries per phase. States:
- `idle` / `running` / `awaiting_gate` / `gate_passed` / `gate_failed` / `terminal` / `migrated`

### design.reviewPassed (semantic change)

Meaning in v1.1+: "Phase 1 embedded design checks completed" (not Phase 2 review passed).

## Migration

If your `progress.json` has `currentPhase: 2`, running `phasegate run` will:
1. Migrate `currentPhase` to `1`
2. Add a `{ phaseId: 2, state: "migrated" }` entry to `phaseStates`
3. Re-run Phase 1 auto-advance to reach Phase 3
```

---

### 3. docs/guides/getting-started.md

更新默认路径说明：

```markdown
### Default Workflow

After `phasegate run` detects your approved requirement, phases advance automatically:

1. **Phase 1** – Design Generation + embedded design self-check
2. **Phase 3** – Parallel Module Development (Phase 2 is now merged into Phase 1)
3. **Phase 4** – Lightweight Final Review Gate
4. **Phase 5** – Acceptance
```

删除对 Phase 2 作为必经步骤的描述。

---

### 4. docs/guides/review-and-acceptance.md

更新"Review Phase"说明：

```markdown
## Phase 3: Self-Review Bundle

Each module worker in Phase 3 is required to produce a self-review bundle including:
- Implementation summary
- Changed files list
- Tests run and test results summary
- Self-review findings (non-blocking observations)
- Known risks

This bundle is the primary input for Phase 4. Without a complete bundle,
Phase 4 will report "insufficient review input" and halt.

## Phase 4: Lightweight Final Review Gate

Phase 4 is no longer a "two-pass code review." It is a **final gate** that:
- Verifies the Phase 3 self-review bundles are complete
- Cross-checks against task book acceptance criteria
- Identifies any P0 (blocking) findings
- Produces a structured `VerdictRecord` (accepted / conditional_pass / rejected)

You do NOT need to re-read all source files in Phase 4.
The review bundles from Phase 3 are the primary source of truth.
```

---

### 5. README.md — Status 章节更新

在"Implemented now"中更新：

```markdown
Implemented now:

- `init`, `chat`, `run`, `status`, `progress`, `review`, `select`
- Phase 1 with embedded design self-check (Phase 2 merged)
- Phase 3 coordinator / worker orchestration with self-review bundle
- Phase 4 lightweight final review gate with structured VerdictRecord
- scope-based AI routing
- progress persistence and resume from disk
- legacy workspace migration (currentPhase: 2 → auto-advance to 3)
```

在"What makes it different"章节，更新 review 相关描述：
```markdown
- phase boundaries reset context instead of carrying one long conversation
- Phase 1 embeds design self-check constraints (no separate review phase)
- Phase 3 workers produce structured self-review bundles for Phase 4 consumption
- Phase 4 is a lightweight final gate, not a full second read-through
```

---

### 6. docs/core/ai-routing.md

在 `phase2` routing scope 的说明中增加：

```markdown
> **Note**: `phase2` scope is retained for backward compatibility.
> It is no longer used in the default auto-advance workflow.
> Existing `phasegate.config.json` files that define a `phase2` routing entry
> will continue to work without error, but the entry will not be invoked in normal runs.
```

---

## Acceptance Criteria

- [ ] `docs/core/workflow-phases.md` 不包含 "two-pass design review" 表述
- [ ] `docs/core/workflow-phases.md` 包含 Phase 2 migration note
- [ ] `docs/core/progress-model.md` 包含 `phase4Verdict`、`phaseStates` 字段说明
- [ ] `docs/guides/getting-started.md` 的默认路径为 Phase 0→1→3→4→5
- [ ] `docs/guides/review-and-acceptance.md` 提及 Phase 3 self-review bundle 的必要性
- [ ] `README.md` Status 章节反映新架构
- [ ] `README.zh-CN.md` / `README.ja.md` 与英文版核心内容一致（不要求逐字翻译，但工作流描述必须一致）
- [ ] `docs/README.md` 中所有内部链接仍然有效（不因文档内容变化而链接失效）

---

## Notes

- `README.zh-CN.md` 和 `README.ja.md` 的深度同步可作为"尽力而为"项——核心工作流描述必须更新，次要细节可滞后
- 文档改动不需要与代码改动在同一 commit，但必须在同一 Stage 内完成
- 改完文档后通过"搜索 'two-pass' 和 'Phase 2'"确认无遗漏
