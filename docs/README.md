# PhaseGate Docs

- Type: core
- Status: active
- Reader: both
- Use when: 需要快速理解 `docs/` 的结构、阅读顺序和主文档位置时
- Source of truth: 是
- Update when: 文档目录结构、主文档边界或阅读入口发生变化时

## Purpose

给 `docs/` 提供稳定入口，避免再按作者习惯堆叠文档。

## Scope

包含：文档分类、阅读顺序、主文档索引、归档说明。

不包含：具体功能规格、历史讨论细节、临时任务过程。

## Reading Order

1. [`documentation-principles.md`](./documentation-principles.md)
2. [`documentation-governance.md`](./documentation-governance.md)
3. [`core/overview.md`](./core/overview.md)
4. 按需进入 `core/`、`guides/`、`tasks/`、`archive/`

## Structure

- `core/`
  - 稳定、跨模块、长期有效的项目事实。
- `guides/`
  - “怎么做”的操作文档和检查指南。
- `tasks/`
  - 临时性、待处理、持续变化的事项。
- `archive/`
  - 历史版本、旧结构、已退出主阅读路径的文档。
- `ideas.md`
  - 非正式想法草稿，稳定后再转正式文档或 `tasks/`。

## Current Canonical Docs

- [`core/overview.md`](./core/overview.md)
  - 项目定位、当前能力边界、文档导航。
- [`core/workflow-phases.md`](./core/workflow-phases.md)
  - Phase 0 到 Phase 5 的真实工作流和 gate。
- [`core/progress-model.md`](./core/progress-model.md)
  - `progress.json` / `progress.md` 的职责与字段。
- [`core/architecture-constraints.md`](./core/architecture-constraints.md)
  - 当前实现真正生效的架构边界。
- [`core/cli-surface.md`](./core/cli-surface.md)
  - CLI 命令面、输入输出、内部调用链。
- [`guides/getting-started.md`](./guides/getting-started.md)
  - 安装、初始化、典型使用流程。
- [`guides/workspace-layout.md`](./guides/workspace-layout.md)
  - `.phasegate/` 目录结构和各文件职责。
- [`guides/testing.md`](./guides/testing.md)
  - 默认测试策略和 live smoke test 边界。
- [`guides/review-and-acceptance.md`](./guides/review-and-acceptance.md)
  - review / acceptance 的人工检查入口。
- [`tasks/backlog.md`](./tasks/backlog.md)
  - 尚未转化为正式文档或代码的待处理事项。
- [`ideas.md`](./ideas.md)
  - 临时想法草稿区。

## Archive Policy

- 本轮整理前的 `design/`、`guide/` 文档整体转入 `archive/legacy-2026-04/`。
- 归档保留追溯价值，但不再作为当前实现依据。
- 后续如果主文档足够稳定，可继续压缩或删除没有历史价值的归档内容。

## Related

- [`documentation-principles.md`](./documentation-principles.md)
- [`documentation-governance.md`](./documentation-governance.md)
- `src/core/phase-executor.ts`
- `src/core/orchestrator.ts`
