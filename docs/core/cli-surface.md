# PhaseGate CLI Surface

- Type: core
- Status: active
- Reader: both
- Use when: 需要确认 CLI 命令面、职责边界和关键内部调用链时
- Source of truth: 是
- Update when: 命令集合、参数、输出物或调用链发生变化时

## Purpose

总结当前对外 CLI 命令及其关键内部职责。

## Scope

包含：命令列表、每个命令的主要职责、关键读写文件。

不包含：交互 prompt 正文、测试矩阵、历史路线图。

## Registered Commands

- `init`
- `status`
- `run`
- `review`
- `chat`
- `progress`

CLI 入口：`src/index.ts`

## Command Summary

### `phasegate init`

- 初始化 `.phasegate/` 工作区
- 创建 `requirements/`、`tasks/`、`contracts/`
- 生成 `requirements.md`
- 写入初始 `progress.json`、`progress.md`、`phasegate.config.json`

### `phasegate chat`

- 只用于 Phase 0
- 按 locale 选择需求讨论 prompt
- 会话结束后立即执行 Phase 0 gate

### `phasegate run`

- 默认读取 `progress.json.currentPhase`
- `--phase <n>` 可强制执行指定阶段
- Phase 1 / 2 / 4 / 5 为 prompt 驱动阶段
- Phase 3 走 orchestrator

### `phasegate status`

- 读取 `progress.json`
- 输出当前阶段和模块状态摘要

### `phasegate progress`

- 展示 `progress.md`

### `phasegate review <module>`

- 对指定模块做补充检查或重试相关流程

## Key Internal Chain

- `run` -> `PhaseExecutor`
- `run` -> `PhaseTransitionManager`
- `Phase 3` -> `Orchestrator`
- 所有状态写回 -> `ProgressManager`

## Related

- [`workflow-phases.md`](./workflow-phases.md)
- [`progress-model.md`](./progress-model.md)
- [`../guides/getting-started.md`](../guides/getting-started.md)
- `src/index.ts`
- `src/commands/init.ts`
- `src/commands/chat.ts`
- `src/commands/run.ts`
