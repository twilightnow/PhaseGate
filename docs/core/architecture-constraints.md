# PhaseGate 架构约束

- Type: core
- Status: active
- Reader: both

## 工作区约束

- 运行时状态保存在 `.phasegate/progress.json` 中。
- 需求文档保存在 `.phasegate/requirements/` 中。
- 活跃执行制品保存在 `.phasegate/tasks/` 和 `.phasegate/contracts/` 中。
- 可丢弃的输出保存在 `.phasegate/scratchpad/` 中。
- 已归档的历史制品保存在 `.phasegate/archive/` 中。

## 执行约束

- 同一时间只能有一个需求处于活跃状态。
- `currentPhase` 是执行本地的，而非工作区全局的。
- Phase 3 的依赖顺序来自任务书的依赖关系。
- Phase 3 工作者输出以结构化的 `report.json` 写入。

## 上下文约束

- 提示阶段应使用注入的上下文文件，而不是重建隐藏状态。
- Phase 4 和 Phase 5 应从 `scratchpad/summaries/` 读取摘要，而不是从已移除的进度日志中读取。
- 需求提示应针对活跃需求执行，除非该阶段明确需要待办列表上下文，否则不应对所有待办文件执行。

## 已知实际限制

- 输出质量仍取决于需求、任务书和合约的质量。
- 某些验证仍需人工判断，尤其是在验收阶段。
- Phase 3 按模块并行，但跨需求的执行仍然是单选模式。

## 相关

- [overview.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/overview.md)
- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
