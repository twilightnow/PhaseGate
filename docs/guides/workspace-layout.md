# 工作区布局

- Type: guide
- Status: active
- Reader: both
- Use when: 需要了解 `.phasegate/` 下内容的归属时

## 布局

```text
.phasegate/
  requirements/
  tasks/
  contracts/
  scratchpad/
  archive/
  progress.json
  phasegate.config.json
```

## 职责说明

### `requirements/`

- 需求文档的待办列表。
- 文件可以在 Phase 0 讨论期间添加或修改。
- 不受活跃执行阻塞。

### `tasks/`

- 当前已选需求的活跃任务书。
- 在 Phase 1 期间重建或更新，在 Phase 2 中评审。

### `contracts/`

- 当前已选需求的活跃接口合约。
- 在 Phase 2 中完成。

### `scratchpad/`

- 可丢弃的执行输出。
- 常见内容：
  - `coordinator/brief.md`
  - `{module}/report.json`
  - `summaries/phase-3-summary.md`
  - `summaries/phase-4-summary.md`
  - `summaries/phase-5-summary.md`

### `archive/`

- 值得保留的历史执行制品。
- 在 Phase 5 完成后的最终化过程中填充。
- 不是每个临时文件的垃圾箱。

### `progress.json`

- 唯一权威的执行状态文件。
- 跟踪 `activeRequirement`、`currentPhase`、需求状态、运行时模块状态和阻塞项。

### `phasegate.config.json`

- 用于适配器选择和 scope 路由的本地配置。

## 注意事项

- 当前实现不维护 `.phasegate/progress.md`。
- 原先保存在进度日志中的摘要现在保存在 `scratchpad/summaries/` 下。

## 相关

- [progress-model.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/progress-model.md)
- [getting-started.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/guides/getting-started.md)
