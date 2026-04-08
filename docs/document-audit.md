# Document Audit

- Type: guide
- Status: active
- Reader: both
- Use when: 需要逐篇确认 `docs/` 中每份文档的有效性、事实来源和处理动作时
- Source of truth: 是
- Update when: 主文档内容被修改、旧文档被删除，或代码实现发生变化时

## Purpose

给本轮文档治理补上逐篇确认结果，避免只有结构调整而没有内容审计。

## Scope

包含：当前主文档确认状态、旧文档处理结论、主要代码依据、残余风险。

不包含：逐段全文 diff、未来路线图展开。

## Audit Basis

本次逐篇确认主要对照以下代码：

- `src/index.ts`
- `src/types.ts`
- `src/commands/init.ts`
- `src/commands/chat.ts`
- `src/commands/run.ts`
- `src/commands/status.ts`
- `src/commands/progress.ts`
- `src/commands/review.ts`
- `src/core/ai-runner.ts`
- `src/core/phase-gate.ts`
- `src/core/progress-manager.ts`
- `src/core/dependency-graph.ts`
- `src/core/phase-executor.ts`
- `src/core/phase-transition-manager.ts`
- `src/core/orchestrator.ts`

## Current Docs

| Document | Result | Evidence | Action | Notes |
|---|---|---|---|---|
| `README.md` | confirmed | 与当前 `docs/` 实际结构一致 | 保留 | 作为阅读入口有效 |
| `documentation-principles.md` | confirmed | 这是治理基线，不依赖代码事实 | 保留 | 当前重组按此执行 |
| `documentation-governance.md` | confirmed | 与当前目录策略一致 | 保留 | 用于日常维护，不承载实现事实 |
| `core/overview.md` | confirmed | 对齐 `index.ts`、`init.ts`、`run.ts`、`phase-transition-manager.ts`、`orchestrator.ts` | 保留 | 只保留高层边界，没有发现与代码冲突 |
| `core/workflow-phases.md` | confirmed | 对齐 `chat.ts`、`run.ts`、`phase-executor.ts`、`phase-transition-manager.ts` | 保留 | 真实体现了 Phase 1 之后自动推进 |
| `core/progress-model.md` | confirmed | 对齐 `types.ts`、`progress-manager.ts`、`status.ts`、`progress.ts` | 保留 | 正确认定 `progress.json` 为唯一状态源 |
| `core/architecture-constraints.md` | confirmed | 对齐 `phase-executor.ts`、`orchestrator.ts`、`dependency-graph.ts` | 保留 | 已同步为新的稳定路径 |
| `core/cli-surface.md` | confirmed | 对齐 `index.ts` 与各 `commands/*.ts` | 保留 | `review` 的定位也已纳入 |
| `guides/getting-started.md` | confirmed | 对齐 `init.ts`、`chat.ts`、`run.ts`、`status.ts`、`progress.ts`、`review.ts` | 保留 | 保留的是最短路径，不再复制内部细节 |
| `guides/workspace-layout.md` | confirmed | 对齐 `init.ts`、`ai-runner.ts`、`phase-transition-manager.ts`、`dependency-graph.ts` | 保留 | 已修正旧文档中的 `design/` 误写 |
| `guides/testing.md` | confirmed | 与现有测试策略文档一致，未发现代码冲突 | 保留 | 更像团队策略文档，不是代码推导文档 |
| `guides/review-and-acceptance.md` | mostly_confirmed | 对齐 `review.ts`、`phase-transition-manager.ts`、`progress-manager.ts` | 保留 | “Acceptance” 部分仍属于流程级口径，不是强约束 |
| `tasks/backlog.md` | confirmed | 来源于旧 `ideas.md` 的待办归集 | 保留 | 明确为任务文档，不作为实现依据 |
| `ideas.md` | confirmed | 明确定位为草稿区，不承载正式实现事实 | 保留 | 作为记录想法的低门槛入口 |

## Legacy Docs

| Legacy Document | Result | Main Issue | Action | Notes |
|---|---|---|---|---|
| `archive/legacy-2026-04/design/00_overview.md` | merged_then_deleted | 与新 `core/overview.md` 重复 | 删除 | 无独立保留价值 |
| `archive/legacy-2026-04/design/01_workflow_phases.md` | merged_then_deleted | 与新 `core/workflow-phases.md` 重复 | 删除 | 无独立保留价值 |
| `archive/legacy-2026-04/design/02_progress_document.md` | merged_then_deleted | 与新 `core/progress-model.md` 重复 | 删除 | 无独立保留价值 |
| `archive/legacy-2026-04/design/03_architecture_constraints.md` | merged_then_deleted | 与新 `core/architecture-constraints.md` 重复 | 删除 | 无独立保留价值 |
| `archive/legacy-2026-04/design/04_product_roadmap.md` | deleted | 已过时且无追溯必要 | 删除 | 已删除 |
| `archive/legacy-2026-04/design/05_cli_design.md` | merged_then_deleted | 与新 `core/cli-surface.md` 重复且易漂移 | 删除 | 无独立保留价值 |
| `archive/legacy-2026-04/guide/usage_guide.md` | merged_then_deleted | 已被 `guides/getting-started.md` 覆盖 | 删除 | 无独立保留价值 |
| `archive/legacy-2026-04/guide/testing.md` | merged_then_deleted | 已被 `guides/testing.md` 覆盖 | 删除 | 无独立保留价值 |
| `archive/legacy-2026-04/guide/command_internals.md` | merged_then_deleted | 长篇重复内部说明，维护成本高 | 删除 | 核心事实保留在 `core/cli-surface.md` |
| `archive/legacy-2026-04/guide/functional_check.md` | deleted | 噪声高且易过时 | 删除 | 已删除 |
| `archive/legacy-2026-04/guide/acceptance-guide.md` | deleted | 标题与正文边界混乱 | 删除 | 已删除 |
| `archive/legacy-2026-04/guide/init-structure/config_guide.md` | merged_then_deleted | 与工作区和入门文档重复 | 删除 | 关键配置说明已并入 `guides/workspace-layout.md` |
| `archive/legacy-2026-04/guide/init-structure/design_contracts_guide.md` | deleted | 使用旧 `design/` 术语 | 删除 | 已删除 |
| `archive/legacy-2026-04/guide/init-structure/phasegate_structure.md` | deleted | 目录树已失效 | 删除 | 已删除 |
| `archive/legacy-2026-04/guide/init-structure/progress_guide.md` | merged_then_deleted | 与 `core/progress-model.md` / `guides/workspace-layout.md` 重复 | 删除 | 无独立保留价值 |
| `archive/legacy-2026-04/guide/init-structure/requirements_guide.md` | merged_then_deleted | 粒度过细，但保留了 gate 边界信息 | 删除 | 关键要求已并入 `guides/workspace-layout.md` |
| `archive/legacy-2026-04/ideas.md` | merged_then_deleted | 旧草稿副本 | 删除 | 当前草稿入口为 `docs/note/ideas.md` |

## Content Findings

本轮逐篇确认发现的重点问题：

- 旧文档最严重的问题不是“完全错误”，而是“局部过时 + 大量重复”。
- `.phasegate/design/` 与 `.phasegate/tasks/` 的口径冲突，是旧文档中最明确的事实错误。
- `design/04_product_roadmap.md` 对“自动阶段推进未完成”的判断已过时。
- `guide/acceptance-guide.md` 的标题、阶段编号和正文边界都不稳定，不应恢复使用。

## Cleanup Result

- `archive/legacy-2026-04/` 中剩余旧稿已全部删除。
- `guides/workspace-layout.md` 已吸收 `requirements_guide.md` 中仍有价值的 Phase 0 gate 边界。
- `guides/workspace-layout.md` 已补充 `config_guide.md` 中仍有价值且与当前代码一致的配置结构说明。
- 当前 `archive/` 目录应保持为空，后续只有在确有追溯价值时才临时使用。

## Residual Risks

- `guides/review-and-acceptance.md` 中 Acceptance 部分仍然是流程口径，不是代码强保证。
- 代码里仍有少量注释沿用旧术语时，文档将继续被污染，需要同步清理。
- 如果后续引入新的 `.phasegate/` 文件或 runner 配置项，`guides/workspace-layout.md` 和 `core/cli-surface.md` 需要优先更新。

## Related

- [`README.md`](./README.md)
- [`documentation-principles.md`](./documentation-principles.md)
- [`documentation-governance.md`](./documentation-governance.md)
