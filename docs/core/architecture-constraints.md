# PhaseGate Architecture Constraints

- Type: core
- Status: active
- Reader: both
- Use when: 需要确认当前实现真正依赖的架构边界和约束时
- Source of truth: 是
- Update when: 工作区布局、依赖模型、调度约束或上下文注入策略发生变化时

## Purpose

只记录当前代码里真正生效的架构约束，而不是理想化设计。

## Scope

包含：工作区边界、状态源、模块编排、上下文注入和已知缺口。

不包含：过长的未来方案、样式级细节、无代码支撑的设想。

## Key Facts / Decisions / Constraints

### Workspace Boundary

- 运行时文件统一放在 `.phasegate/`。
- CLI 不依赖外部数据库。
- 中间资产可以直接纳入 git 跟踪。

### State Boundary

- 运行时源数据只认 `.phasegate/progress.json`。
- `progress.md` 是投影视图，不是状态源。

### Dependency Model

- Phase 3 依赖从 `.phasegate/tasks/*.md` 中解析。
- DAG 由 `DependencyGraph` 构建。
- 已完成模块会在续跑时跳过。
- 失败模块会阻断下游模块。

### Context Injection

- 非 Phase 3 阶段的 prompt context 由 `PhaseExecutor.buildPhaseContextFiles()` 构建。
- 架构约束文档会作为共享上下文注入后续阶段。
- Phase 5 还会附带 `scratchpad/*/report.json` 作为验收输入。

## Known Gaps

- `ConstraintChecker` 目前仍接近 stub，约束校验不充分。
- Phase 4 gate 依赖 `progress.md` 中的文本区块，结构化程度有限。
- 部分流程依赖 markdown 约定而非强 schema。

## Related

- [`overview.md`](./overview.md)
- [`workflow-phases.md`](./workflow-phases.md)
- `src/core/phase-executor.ts`
- `src/core/orchestrator.ts`
- `src/core/dependency-graph.ts`
