# PhaseGate 工作流阶段

- Type: core
- Status: active
- Reader: both
- Use when: 需要了解从 Phase 0 到 Phase 5 的执行模型时

## 阶段表

| 阶段 | 名称 | 入口 | 备注 |
|---|---|---|---|
| 0 | 需求讨论 | `phasegate chat` | |
| 1 | 设计生成（含内嵌自检） | `phasegate run` | |
| ~~2~~ | ~~设计评审~~ | — | **已迁移** — 折叠进 Phase 1 |
| 3 | 模块并行开发 | `phasegate run` | 工作者产出自审包 |
| 4 | 轻量最终评审 | `phasegate run` | 结构化 VerdictRecord 门控 |
| 5 | 验收 | `phasegate run` | |

**活跃阶段序列：** `0 → 1 → 3 → 4 → 5`

## 核心规则

- Phase 0 仅用于积累或修改需求。
- 执行需要选定一个需求。
- `currentPhase` 仅适用于活跃需求。
- 如果 `activeRequirement` 为 `null`，执行处于空闲状态。

## Phase 0

- 使用 `phasegate chat` 开始或继续讨论。
- 门控审批将发现的需求文件同步到 `progress.json`。
- 已批准的需求保留在待办列表中，直到被明确选择。

## 选择

- 使用 `phasegate select <requirement>` 将一个已批准的需求绑定到执行。
- 选择操作会设置 `activeRequirement` 并将执行重置到 Phase 1。

## Phase 1

- 为活跃需求生成 `.phasegate/tasks/*.md` 和 `.phasegate/contracts/*.md`。
- AI 在同一回应中执行**内嵌设计自检**（一致性、风险、公共接口）。
- 成功后，运行时将 `design.reviewPassed` 设为 `true`，并将设计模块和合约同步到 `progress.json`。
- 直接推进到 Phase 3。

## Phase 2（已迁移）

Phase 2（设计评审）已**折叠进 Phase 1**。如果在现有 `progress.json` 中发现 `currentPhase: 2`，会自动迁移为 `currentPhase: 1`，并在 `phaseStates` 中记录一条 `{phaseId: 2, state: 'migrated'}` 条目。Phase 2 不会进行 AI 调用。

## Phase 3

- 从任务书构建依赖 DAG。
- 通过 orchestrator 按波次运行工作者。
- 将工作者报告写入 `.phasegate/scratchpad/{module}/report.json`。
- 将执行摘要写入 `.phasegate/scratchpad/summaries/`。
- 当没有模块失败时推进到 Phase 4。

## Phase 4

- **轻量最终评审门控** — 验证工作者自审包是否完整，且风险可接受。
- 上下文：`progress.json`、仅**已完成**模块的任务书、合约、含自审包的工作者报告、Phase 3 摘要。
- AI 响应一个结构化的 `VerdictRecord` JSON 块（`accepted` / `conditional_pass` / `rejected`）。
- `accepted` / `conditional_pass` → 门控通过，通过 `pm.recordPhaseVerdict` 记录裁决，推进到 Phase 5。
- `rejected` → `gate_failed` 状态，执行停止。
- 当输出中不含 JSON 块时，回退到遗留 PASS/FAIL 关键字检测。

## Phase 5

- 验证活跃需求的验收标准。
- 使用工作者报告和之前的摘要作为输入。
- 生成 `acceptance-guide.md`。
- 最终化时归档持久性制品，清除活跃执行，并将需求标记为已实现。

## 相关

- [progress-model.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/progress-model.md)
- [cli-surface.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/cli-surface.md)
- [phase-transition-manager.ts](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/phase-transition-manager.ts)
