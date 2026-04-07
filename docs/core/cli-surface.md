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

包含：命令列表、每个命令的主要职责、关键读写文件、scope 级 AI 路由入口。

不包含：交互 prompt 正文、测试矩阵、历史设计讨论。

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
- 默认生成 `aiProfiles` / `aiRouting`，启用 scope-based AI routing

### `phasegate chat`

- 只用于 Phase 0
- 按 locale 选择需求讨论 prompt
- 会话结束后立即执行 Phase 0 gate
- runner scope：`chat`

### `phasegate run`

- 默认读取 `progress.json.currentPhase`
- `--phase <n>` 可强制执行指定阶段
- Phase 1 / 2 / 4 / 5 为 prompt 驱动阶段
- Phase 3 走 `Orchestrator`
- Phase 1 / 2 / 4 / 5 分别使用 `phase1` / `phase2` / `phase4` / `phase5` scope
- Phase 3 先使用 `phase3.coordinator` 生成 coordination brief，再使用 `phase3.worker` 并行 fork worker

### `phasegate status`

- 读取 `progress.json`
- 输出当前阶段和模块状态摘要

### `phasegate progress`

- 展示 `progress.md`

### `phasegate review <module>`

- 对指定模块做补充检查或重试相关流程
- runner scope：`phase4`

## Key Internal Chain

- `run` -> `PhaseExecutor`
- `run` -> `PhaseTransitionManager`
- `Phase 3` -> `Orchestrator`
- `createRunner(projectRoot, scope)` -> `scope -> profile -> adapter`
- 所有状态写回 -> `ProgressManager`

## Related

- [`workflow-phases.md`](./workflow-phases.md)
- [`progress-model.md`](./progress-model.md)
- [`ai-routing.md`](./ai-routing.md)
- [`../guides/getting-started.md`](../guides/getting-started.md)
- `src/index.ts`
- `src/commands/init.ts`
- `src/commands/chat.ts`
- `src/commands/run.ts`
