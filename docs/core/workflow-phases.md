# PhaseGate Workflow Phases

- Type: core
- Status: active
- Reader: both
- Use when: 需要确认各阶段入口、推进规则和 gate 行为时
- Source of truth: 是
- Update when: Phase 流程、命令入口或阶段推进逻辑变化时

## Purpose

定义当前代码中真实存在的 Phase 0 到 Phase 5 流程。

## Scope

包含：阶段总览、入口命令、自动推进规则、各阶段 gate、Phase 3 的 coordinator / worker 分工。

不包含：prompt 正文、长篇产品讨论、测试细节。

## Phase Table

| Phase | Name | Entry | Current Status |
|---|---|---|---|
| 0 | Requirements Discussion | `phasegate chat` | 已实现 |
| 1 | Design Generation | `phasegate run` | 已实现 |
| 2 | Design Review | `phasegate run` | 已实现 |
| 3 | Parallel Module Development | `phasegate run` | 已实现 |
| 4 | Code Review | `phasegate run` | 已实现 |
| 5 | Acceptance | `phasegate run` | 已实现 |

## Key Facts / Decisions / Constraints

- Phase 0 不走 `run`，而是强制使用 `chat`。
- 未指定 `--phase` 时，`phasegate run` 会依据 `progress.json.currentPhase` 连续推进后续阶段。
- 每个阶段完成后都先过 gate，再写回 `progress.json` / `progress.md`。
- Phase 3 是唯一带专门调度器和断点续跑逻辑的阶段。
- Phase 3 当前已经区分 `phase3.coordinator` 和 `phase3.worker` 两个 AI scope。

## Phase 0

入口：`phasegate chat [--feature <name>]`

流程：

1. 检查 `.phasegate/progress.json` 是否存在。
2. 根据 locale 选择 prompt 文件。
3. 启动交互式会话。
4. 会话结束后执行 `checkPhase0Gate(cwd)`。
5. Gate 通过则把 `currentPhase` 更新为 `1`。

## Phase 1

入口：`phasegate run`

输出要求：

- `.phasegate/tasks/` 至少有一个任务文档。
- `.phasegate/contracts/` 至少有一个契约文档。

完成后动作：

- 从 `tasks/` 生成 `progress.design.modules`
- 从 `contracts/` 生成 `progress.design.contracts`
- 初始化 `progress.modules`
- 推进到 Phase 2

## Phase 2

入口：`phasegate run`

Gate 条件：

- `.phasegate/contracts/*.md` 中所有契约的 `## Status` 都为 `finalized`

通过后动作：

- `progress.design.reviewPassed = true`
- `currentPhase = 3`

## Phase 3

入口：`phasegate run`

核心行为：

- 先使用 `phase3.coordinator` runner 生成 coordination brief，写入 `.phasegate/scratchpad/coordinator/brief.md`
- 基于 `tasks/*.md` 中的依赖关系构建 DAG
- 按 wave 并行启动模块 worker，使用 `phase3.worker` runner
- 已完成模块在续跑时会被跳过
- 失败模块会阻断下游模块

完成条件：

- 所有模块状态都为 `done` 或 `blocked`
- 且不存在 `failed`

通过后动作：

- 向 `progress.md` 追加 `Phase 3 Summary`
- `currentPhase = 4`

## Phase 4

入口：`phasegate run`

Gate 条件：

- `.phasegate/progress.md` 中出现 `## Phase 4 Summary`

通过后动作：

- `progress.codeReviewPassed = true`
- `currentPhase = 5`

## Phase 5

入口：`phasegate run`

当前行为：

- 作为最后一个 prompt 驱动阶段执行
- 结束后自动停止，不再推进后续 phase

## Related

- [`progress-model.md`](./progress-model.md)
- [`cli-surface.md`](./cli-surface.md)
- [`ai-routing.md`](./ai-routing.md)
- `src/commands/chat.ts`
- `src/commands/run.ts`
- `src/core/phase-transition-manager.ts`
