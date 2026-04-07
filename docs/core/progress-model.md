# PhaseGate Progress Model

- Type: core
- Status: active
- Reader: both
- Use when: 需要理解 `progress.json`、`progress.md` 以及状态推进字段时
- Source of truth: 是
- Update when: `ProjectProgress` 类型、状态机字段或进度同步方式变化时

## Purpose

定义 PhaseGate 的进度数据模型，以及机器状态与阅读视图之间的边界。

## Scope

包含：`progress.json`、`progress.md`、核心字段、状态更新规则。

不包含：Phase prompt 细节、模块任务文档格式全文。

## Key Facts / Decisions / Constraints

- `progress.json` 是唯一状态写入源。
- `progress.md` 仅用于人类和 AI 阅读，不应作为状态写入入口。
- 所有命令和 orchestrator 都以 `progress.json` 为准。
- `ProgressManager.write()` 负责把 `progress.json` 投影为 `progress.md`。

## Type Summary

类型定义来自 `src/types.ts`：

```ts
type PhaseId = 0 | 1 | 2 | 3 | 4 | 5;
type ItemStatus = 'pending' | 'done' | 'blocked' | 'failed';
type ModuleRunStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked';
type ContractStatus = 'draft' | 'finalized';
```

## `progress.json`

核心结构：

```json
{
  "projectName": "PhaseGate",
  "locale": "zh",
  "currentPhase": 0,
  "requirements": [],
  "design": {
    "modules": [],
    "contracts": [],
    "reviewPassed": false
  },
  "modules": [],
  "codeReviewPassed": false,
  "blockers": []
}
```

字段边界：

- `requirements`
  - Phase 0 / 1 相关的需求项状态
- `design.modules`
  - Phase 1 产出的模块级设计状态
- `design.contracts`
  - 契约清单及 `draft/finalized` 状态
- `modules`
  - Phase 3 运行时模块状态，允许 `running`
- `codeReviewPassed`
  - Phase 4 gate 结果
- `blockers`
  - 全局阻塞信息

## `progress.md`

定位：

- 面向人类和 AI 的摘要视图
- 默认由 PhaseGate 自动重写
- 可包含阶段总结区块，但不应被视为机器真相

当前约束：

- Phase 3 完成后，系统会尝试追加 `## Phase 3 Summary`
- Phase 4 gate 通过依赖 `progress.md` 中存在 `## Phase 4 Summary`

## Related

- [`workflow-phases.md`](./workflow-phases.md)
- [`../guides/workspace-layout.md`](../guides/workspace-layout.md)
- `src/types.ts`
- `src/core/progress-manager.ts`
