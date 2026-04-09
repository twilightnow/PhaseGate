# PhaseGate 概述

- Type: core
- Status: active
- Reader: both

## PhaseGate 的功能

PhaseGate 是一个分阶段的 AI 编码工作流，适用于需要比单次长对话更严格规范的代码仓库。

它将工作分为两个层次：

- `.phasegate/requirements/` 中的需求池
- 由 `progress.json` 跟踪的单一活跃执行流

## 为什么这个模型很重要

- 新需求可以在另一个需求执行期间持续积累。
- 跨需求的执行保持单线程。
- 临时运行输出保存在 `scratchpad/` 中。
- 完成后，持久性制品可以归档。
- 需求支持 `priority`（`high` / `normal` / `low`）优先级，`phasegate loop` 按优先级队列自动消费。

## 关键运行时组件

- `ProgressManager`
  - 读写 `progress.json`
  - 将需求文档同步到待办列表模型中
- `PhaseExecutor`
  - 为提示驱动的阶段准备上下文
- `PhaseTransitionManager`
  - 评估阶段门控并推进执行
- `Orchestrator`
  - 运行 Phase 3 模块工作者

## 当前状态模型

- `progress.json` 是唯一的状态来源
- `activeRequirement` 将执行绑定到一个需求
- `currentPhase` 仅限于该活跃需求的本地范围
- 阶段摘要保存在 `.phasegate/scratchpad/summaries/` 中

## 相关

- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
- [progress-model.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/progress-model.md)
- [architecture-constraints.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/architecture-constraints.md)
