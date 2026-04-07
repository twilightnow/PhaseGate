# PhaseGate Overview

- Type: core
- Status: active
- Reader: both
- Use when: 需要先理解项目定位、当前实现边界和主文档分布时
- Source of truth: 是
- Update when: 项目定位、核心能力或文档主入口发生变化时

## Purpose

提供 PhaseGate 的高层全貌，并明确哪些能力已实现、哪些仍是后续议题。

## Scope

包含：项目目标、运行时模型、核心模块、已实现与未实现边界。

不包含：每个命令的完整细节、测试步骤、历史路线图展开。

## Key Facts / Decisions / Constraints

- PhaseGate 是一个 Node.js + TypeScript CLI，用来把 AI 协作开发拆成可推进、可检查、可恢复的阶段。
- 运行时工作区统一放在 `.phasegate/`，而不是项目根目录散落文件。
- `progress.json` 是单一事实源，`progress.md` 是同步生成的阅读视图。
- Phase 0 使用 `phasegate chat`，Phase 1 到 Phase 5 主要通过 `phasegate run` 推进。
- Phase 3 是唯一有专门调度器的阶段，负责依赖拓扑下的并行模块执行。

## Current Workspace Model

```text
.phasegate/
  requirements/
    requirements.md
    {feature}.md
  tasks/
  contracts/
  scratchpad/
  progress.json
  progress.md
  phasegate.config.json
```

## Core Modules

- `src/index.ts`
  - CLI 入口，注册 `init/status/run/review/chat/progress`
- `src/core/progress-manager.ts`
  - 维护 `progress.json` 并同步生成 `progress.md`
- `src/core/phase-gate.ts`
  - Phase 0 gate 与 locale 探测
- `src/core/phase-executor.ts`
  - Phase 1 / 2 / 4 / 5 的 prompt phase 上下文准备
- `src/core/phase-transition-manager.ts`
  - 各阶段完成后的 gate 校验与 phase 推进
- `src/core/orchestrator.ts`
  - Phase 3 并行调度、失败阻断、断点续跑

## Reality Boundary

已实现：

- `.phasegate/` 初始化
- Phase 0 gate 校验并推进到 Phase 1
- Phase 1 后读取 `tasks/` 和 `contracts/` 同步回 `progress.json`
- Phase 1 到 Phase 5 的自动连续推进
- Phase 3 依赖分波次并行执行
- Phase 3 失败模块阻断下游模块
- `progress.json -> progress.md` 自动同步
- 独立模块评审命令 `phasegate review <module>`

尚不成熟或仍待增强：

- 真正有效的约束检查器
- 更强的 contract schema 校验
- Phase 4 / 5 的结构化闭环输出
- 更细粒度的恢复策略和状态追踪

## Related

- [`workflow-phases.md`](./workflow-phases.md)
- [`progress-model.md`](./progress-model.md)
- [`architecture-constraints.md`](./architecture-constraints.md)
- [`cli-surface.md`](./cli-surface.md)
