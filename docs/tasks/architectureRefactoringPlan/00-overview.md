# PhaseGate Architecture Refactoring — Master Overview

- Type: plan
- Status: draft
- Created: 2026-04-08
- Reader: both
- Source of truth: this file

## Summary

本次重构面向三个核心目标：

1. **Review 职责重分配**（review-phase-optimization-plan.md 延伸落地）：Phase 2 折叠进 Phase 1，Phase 4 改为轻量 final gate，Phase 3 内嵌自审 bundle
2. **数据模型升级**（architecture-priorities-roadmap.md Milestone 1 + 2）：progress.json 升级为可恢复状态机；verdict 结构化；gate 改为结果导向
3. **上下文治理**（Milestone 3）：各 phase 装载最小必要上下文；worker report 扩展为 review bundle

重构范围覆盖：TypeScript 源码、prompts 目录、docs 目录、测试文件。

---

## Module Breakdown

| 模块编号 | 文件 | 核心内容 |
|---|---|---|
| M1 | [01-type-system.md](./01-type-system.md) | PhaseId 调整、verdict schema、WorkerReport 扩展、状态机类型 |
| M2 | [02-progress-manager.md](./02-progress-manager.md) | progress.json 结构升级、状态机实现、兼容迁移层 |
| M3 | [03-phase-transition.md](./03-phase-transition.md) | Phase 2 移除逻辑、gate 改为结果导向、transition 规则更新 |
| M4 | [04-phase-executor.md](./04-phase-executor.md) | Phase 2 → no-op 路由、context loading 收缩、Phase 4 输入重构 |
| M5 | [05-orchestrator-worker.md](./05-orchestrator-worker.md) | Worker report 扩展为 review bundle、Phase 3 自审输出标准化 |
| M6 | [06-prompts.md](./06-prompts.md) | Phase 1 嵌入设计自检、Phase 4 改为轻量 gate、Phase 3 自审指令 |
| M7 | [07-cli-commands.md](./07-cli-commands.md) | run/review/status 命令语义更新、--phase 2 兼容处理 |
| M8 | [08-tests.md](./08-tests.md) | 测试 fixture 更新、新增 gate 和兼容性测试 |
| M9 | [09-docs.md](./09-docs.md) | docs/core、docs/guides、README 多语言同步更新 |

---

## Execution Phases

### Stage 1 — 数据模型与兼容层（不破坏现有行为）

顺序：M1 → M2 → M3

目标：在不改变用户可见行为的前提下，把类型系统和状态机改成新架构基础。

Gate 条件：`npm run build` 通过；旧 progress.json 可被 normalizeProgress 正确读取。

### Stage 2 — 执行层重构（改变 phase 推进逻辑）

顺序：M4 → M5

目标：主流程从 `0→1→2→3→4→5` 改为 `0→1→3→4→5`；Phase 4 使用 review bundle 作为主输入。

Gate 条件：`phasegate run` 在新初始化项目中不再停在 Phase 2；Phase 4 context loading 只包含目标字段。

### Stage 3 — Prompt 重构（改变 AI 行为）

顺序：M6

目标：Phase 1 prompt 内嵌设计自检约束；Phase 3 worker prompt 产出标准化自审 bundle；Phase 4 prompt 改为轻量 gate。

Gate 条件：运行一个 end-to-end 样本，验证 Phase 4 输入体积下降且不丢失 P0 blocker。

### Stage 4 — CLI、测试、文档（收尾对齐）

顺序：M7 → M8 → M9

目标：所有用户可见的表层（CLI 文案、文档、README）与新架构保持一致。

Gate 条件：所有测试通过；README 不再出现"两遍 review"叙述。

---

## Key Decisions

| 决策 | 结论 |
|---|---|
| Phase 2 处理方式 | 默认跳过；保留 prompt 文件供 strict mode；CLI `--phase 2` 打印迁移提示 |
| PhaseId 编号 | 保留 `0│1│2│3│4│5` 数字范围；内部把 `2` 标记为 no-op/migrated |
| `design.reviewPassed` 字段 | 兼容期内保留，语义改为"Phase 1 embedded design checks passed" |
| WorkerReport 扩展 | 必填新增字段：implementationSummary / changedFiles / testsRun / selfReviewFindings / knownRisks |
| Phase 4 context loading | 只注入：task books + review bundles + changed files + test results |
| 旧 workspace 兼容性 | `currentPhase: 2` 迁移至 `1`，重新执行 Phase 1 → 3 推进 |

---

## Risk Register

| 风险 | 缓解措施 |
|---|---|
| 旧 workspace 停留在 Phase 2 | progressive-manager 加迁移钩子，CLI 明确输出迁移提示 |
| review quality regression | Phase 1 严格嵌入 self-check；Phase 3 bundle 必须包含 known risks；Phase 4 prompt 保留 P0/P1/P2 分级 |
| prompt-runtime 不同步 | M6 prompt 改动必须在同一 PR 内同步更新 phase-executor context loading |
| 文档漂移 | M9 文档更新与 Stage 4 同一批次提交，不允许拆分推迟 |
| 过早铺太大 | 严格按 Stage 顺序推进；每 Stage 必须 gate 通过后才进入下一 Stage |
