# PhaseGate CLI 接口

- Type: core
- Status: active
- Reader: both
- Use when: 需要了解命令级别行为时

## 命令

- `phasegate init`
  - 创建 `.phasegate/`
  - 创建 `requirements/`、`tasks/`、`contracts/`、`scratchpad/`、`archive/`
  - 写入 `progress.json` 和 `phasegate.config.json`
- `phasegate chat`
  - 运行 Phase 0 需求讨论
  - Phase 0 门控通过后审批需求文档
- `phasegate select <requirement>`
  - 选择一个已批准的需求用于执行
- `phasegate run`
  - 从当前阶段开始执行活跃需求
  - `--requirement <name>` 一步完成选择并执行
  - `--phase <n>` 强制指定特定阶段
- `phasegate loop`
  - 按优先级顺序自动选取并运行所有 `approved` 状态的需求
  - 每完成一条需求后动态重新加载队列，响应 Phase 0 期间新增的需求
  - `gate_failed` 时立即停止，保留 `activeRequirement` 以便人工处理
- `phasegate loop --dry-run`
  - 预览执行顺序（含 priority、approvedAt），不实际运行
- `phasegate status`
  - 从 `progress.json` 打印可读的执行概览
  - 输出末尾显示待执行队列条数，提示用 `loop --dry-run` 查看顺序
- `phasegate progress`
  - 打印原始结构化的 `progress.json` 状态
- `phasegate review <module>`
  - 对特定模块运行聚焦审查

## 注意事项

- `progress.json` 是唯一的状态权威来源。
- 没有 CLI 命令用于显示或维护 `progress.md`。
- Phase 3 直接使用 orchestrator；其他阶段使用基于提示的执行。

## 相关

- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
- [getting-started.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/guides/getting-started.md)
- [index.ts](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/index.ts)
