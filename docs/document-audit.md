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
| `archive/legacy-2026-04/design/00_overview.md` | partially_confirmed | 内容大体正确，但与新 `core/overview.md` 重复 | 归档 | 有追溯价值，无需再作为主文档 |
| `archive/legacy-2026-04/design/01_workflow_phases.md` | confirmed_but_redundant | 与新 `core/workflow-phases.md` 重复 | 归档 | 内容本身基本准确 |
| `archive/legacy-2026-04/design/02_progress_document.md` | confirmed_but_redundant | 与新 `core/progress-model.md` 重复 | 归档 | 内容本身基本准确 |
| `archive/legacy-2026-04/design/03_architecture_constraints.md` | confirmed_but_redundant | 与新 `core/architecture-constraints.md` 重复 | 归档 | 原内容有效，路径已被新文档替代 |
| `archive/legacy-2026-04/design/04_product_roadmap.md` | deleted | 写明“Phase 1 之后自动阶段推进闭环未完成”，且无保留价值 | 删除 | 已删除 |
| `archive/legacy-2026-04/design/05_cli_design.md` | partially_confirmed | 部分内容准确，但与新 `core/cli-surface.md` 重复且可能继续漂移 | 归档 | 适合保留历史设计口径，不适合作为主文档 |
| `archive/legacy-2026-04/guide/usage_guide.md` | partially_confirmed | 主流程基本正确，但与 `testing`、`init-structure` 重复 | 归档 | 已拆并进 `guides/getting-started.md` |
| `archive/legacy-2026-04/guide/testing.md` | confirmed_but_redundant | 内容有效，但已被新 `guides/testing.md` 接管 | 归档 | 可随时删除其旧副本 |
| `archive/legacy-2026-04/guide/command_internals.md` | partially_confirmed | 对 `init` 等命令有价值，但细节较长且维护成本高 | 归档 | 其核心事实已并入 `core/cli-surface.md` |
| `archive/legacy-2026-04/guide/functional_check.md` | deleted | 混入环境权限建议和阶段性自检清单，噪声高且易过时 | 删除 | 已删除 |
| `archive/legacy-2026-04/guide/acceptance-guide.md` | deleted | 标题写 Phase 2，正文写人工验收，边界混乱 | 删除 | 已删除 |
| `archive/legacy-2026-04/guide/init-structure/config_guide.md` | confirmed_but_redundant | 与工作区和入门文档重复 | 归档 | 已合并进 `guides/workspace-layout.md` |
| `archive/legacy-2026-04/guide/init-structure/design_contracts_guide.md` | deleted | 继续使用 `design/` 说法，但当前代码是 `tasks/` | 删除 | 已删除 |
| `archive/legacy-2026-04/guide/init-structure/phasegate_structure.md` | deleted | 目录树仍写 `.phasegate/design/` | 删除 | 已删除 |
| `archive/legacy-2026-04/guide/init-structure/progress_guide.md` | confirmed_but_redundant | 主要内容有效，但与新 `core/progress-model.md` / `guides/workspace-layout.md` 重复 | 归档 | 可删除其旧副本 |
| `archive/legacy-2026-04/guide/init-structure/requirements_guide.md` | partially_confirmed | 需求目录定位基本正确，但粒度过细 | 归档 | 已并入 `guides/workspace-layout.md` |
| `archive/legacy-2026-04/ideas.md` | archived | 旧草稿副本 | 归档 | 当前活动草稿入口改为 `docs/ideas.md` |

## Content Findings

本轮逐篇确认发现的重点问题：

- 旧文档最严重的问题不是“完全错误”，而是“局部过时 + 大量重复”。
- `.phasegate/design/` 与 `.phasegate/tasks/` 的口径冲突，是旧文档中最明确的事实错误。
- `design/04_product_roadmap.md` 对“自动阶段推进未完成”的判断已过时。
- `guide/acceptance-guide.md` 的标题、阶段编号和正文边界都不稳定，不应恢复使用。

## Residual Risks

- `guides/review-and-acceptance.md` 中 Acceptance 部分仍然是流程口径，不是代码强保证。
- 代码里仍有少量注释沿用旧术语时，文档将继续被污染，需要同步清理。
- 如果后续引入新的 `.phasegate/` 文件或 runner 配置项，`guides/workspace-layout.md` 和 `core/cli-surface.md` 需要优先更新。

## Related

- [`README.md`](./README.md)
- [`documentation-principles.md`](./documentation-principles.md)
- [`documentation-governance.md`](./documentation-governance.md)
