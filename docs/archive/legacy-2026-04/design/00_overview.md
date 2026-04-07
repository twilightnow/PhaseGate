# PhaseGate 设计总览

> 目标设计与当前实现差距说明，更新时间：2026-04-07

## 1. 项目定位

PhaseGate 是一个 Node.js + TypeScript 编写的 CLI，用来把 AI 协作开发拆成一组可推进、可检查、可恢复的阶段。目标形态不是“逐阶段手动操控的脚手架”，而是：

- 用 `.phasegate/` 目录保存项目内工作区
- 用 `progress.json` 作为单一事实源
- 用 `progress.md` 提供给人和 AI 阅读的进度视图
- 用 `phasegate run` 在 Phase 1 之后统一驱动各阶段
- 用 prompt + CLI runner 执行阶段内 AI 工作
- 在 Phase 3 里按依赖拓扑并行执行模块开发

## 2. 当前真实目录模型

当前代码实际使用的是 `.phasegate/`，不是旧文档里提到的项目根目录散落文件：

```text
.phasegate/
  requirements/
    requirements.md          # init 生成的模板
    {feature}.md             # Phase 0 讨论产物
  tasks/                     # Phase 1 生成的模块任务书
  contracts/                 # Phase 1 生成的接口契约
  scratchpad/                # Phase 3 worker 中间产物
  progress.json              # source of truth
  progress.md                # 人类/AI 可读视图
  phasegate.config.json      # 配置
```

## 3. 核心模块

- `src/index.ts`
  - CLI 入口，注册 `init/status/run/review/chat/progress`
- `src/core/progress-manager.ts`
  - 维护 `.phasegate/progress.json`
  - 同步生成 `.phasegate/progress.md`
- `src/core/phase-gate.ts`
  - Phase 0 gate 校验
  - locale 探测
- `src/core/ai-runner.ts`
  - 适配 `claude/gemini/codex` 三类 CLI
- `src/core/dependency-graph.ts`
  - 从 `.phasegate/tasks/*.md` 和 `.phasegate/contracts/*.md` 构建依赖图
- `src/core/orchestrator.ts`
  - 负责 Phase 3 并行调度、断点恢复、失败阻断、retry
- `src/core/constraint-checker.ts`
  - 目前仍是 stub，实现上始终返回通过

## 4. 目标工作流

```text
init
  -> chat (Phase 0)
  -> run   (Phase 1)
  -> run   (Phase 2)
  -> run   (Phase 3)
  -> run   (Phase 4)
  -> run   (Phase 5)
```

- `phasegate chat` 只用于 Phase 0
- `phasegate run` 自动从 `progress.json.currentPhase` 决定执行哪个阶段，并在正常路径上继续推进后续阶段
- Phase 3 是唯一有专门调度逻辑的阶段

补充边界：

- Phase 3 内部断点续跑属于既定能力
- `phasegate run` 的跨阶段恢复/断点再开始属于后续设计议题，本轮不展开细化
- 当阶段 gate 失败、人工验收未完成或用户显式指定 `--phase` 时，允许人工介入

## 5. 当前实现与设计边界

下面这些是“代码已实现”的行为：

- `.phasegate` 初始化
- Phase 0 requirements 讨论后的 gate 校验
- Phase 1 结束后把 `tasks/contracts` 同步回 `progress.json`
- Phase 3 依赖分波次并行执行
- Phase 3 失败模块阻断下游模块
- `progress.json -> progress.md` 自动同步
- 独立模块评审命令 `phasegate review <module>`

下面这些是“目标设计已明确，但当前实现尚未完全对齐”的行为：

- Phase 1 之后由 `phasegate run` 自动推进到后续阶段
- Phase 2 / 4 / 5 产生结构化结果并驱动状态前进
- 阶段 gate 结果稳定写回 `progress.json`
- 跨阶段恢复/断点再开始策略

下面这些在文档里经常被写成“已有”，但当前代码还没有：

- 真正的约束校验器
- Phase 2 / Phase 4 自动修改文件的审查闭环
- Acceptance 阶段的人类验收工单生成
- 丰富的 contract schema 校验
- 更细粒度的任务恢复和状态追踪

## 6. 文档索引

- [01_workflow_phases.md](./01_workflow_phases.md): 各阶段真实流程
- [02_progress_document.md](./02_progress_document.md): `progress.json` 与 `progress.md`
- [03_architecture_constraints.md](./03_architecture_constraints.md): 当前实现遵循的架构约束与缺口
- [04_product_roadmap.md](./04_product_roadmap.md): 产品路线图
- [05_cli_design.md](./05_cli_design.md): CLI 命令与内部调用链
