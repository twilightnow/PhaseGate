# PhaseGate 设计书：CLI 设计

> 目标 CLI 设计，含当前实现差距，更新时间：2026-04-07

## 1. 技术栈与入口

- 语言：TypeScript
- 运行时：Node.js
- CLI 框架：`commander`
- 文件系统：`fs-extra`
- 控制台反馈：`chalk`、`ora`

CLI 入口是 [`src/index.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/index.ts)。

当前注册命令：

- `init`
- `status`
- `run`
- `review`
- `chat`
- `progress`

## 2. 命令设计

## `phasegate init`

实现位置：[`src/commands/init.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/commands/init.ts)

职责：

- 初始化 `.phasegate/` 工作区
- 生成 requirements 模板
- 写入初始 `progress.json`
- 生成 `progress.md`
- 写入默认配置

默认配置：

```json
{
  "maxLinesPerFile": 500,
  "minTestCoverage": 80,
  "runner": "claude"
}
```

注意：当前初始化创建的是 `.phasegate/tasks/`，不是旧文档中的 `.phasegate/design/`。

## `phasegate chat`

实现位置：[`src/commands/chat.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/commands/chat.ts)

职责：

- 启动 Phase 0 交互式需求讨论
- 根据 locale 选择 prompt
- 会话结束后自动执行 gate 校验
- gate 通过则推进到 Phase 1

参数：

- `--feature <name>`

## `phasegate status`

实现位置：[`src/commands/status.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/commands/status.ts)

职责：

- 读取 `progress.json`
- 输出简版状态概览

它显示的是摘要，不是完整 markdown 文档。

## `phasegate progress`

实现位置：[`src/commands/progress.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/commands/progress.ts)

职责：

- 直接读取并打印 `.phasegate/progress.md`

## `phasegate run`

实现位置：[`src/commands/run.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/commands/run.ts)

职责：

- 根据 `progress.currentPhase` 自动驱动阶段
- 支持 `--phase <n>` 手动覆盖
- 在常规路径中，Phase 1 之后不要求用户逐阶段手动再次输入命令

设计边界：

- Phase 3 内部断点续跑属于既定能力
- `phasegate run` 的跨阶段恢复/断点再开始策略后续单独设计
- `--phase <n>` 主要用于调试、人工接管或异常恢复

分支行为：

- `phase === 0`
  - 提示改用 `phasegate chat`
- `phase === 3`
  - 走 `PhaseExecutor.execute(3)`
- 其他阶段
  - 走 `PhaseExecutor.execute(phase)`，再由 `PhaseTransitionManager.resolve()` 决定 gate 与下一阶段

### `PhaseExecutor` 的真实上下文

当前会注入给 AI 的只有：

- `.phasegate/progress.md`
- `docs/03_architecture_constraints.md`

这意味着：

- Phase 1/2/4/5 的上下文仍然比较薄
- 更细的 requirements/task/source 文件并不是由命令层自动注入，而是依赖 prompt 引导 AI 去读取或写入

目标行为补充：

- Phase 1 完成后应推进到 Phase 2，并继续后续流程
- Phase 2 完成后应写回 review 结果并推进到 Phase 3
- Phase 4 完成后应写回 review 结果并推进到 Phase 5
- Phase 5 结束时才把控制权稳定交还给用户，除非中途 gate 失败或需要人工验收

### `PhaseExecutor` / `PhaseTransitionManager` 的 Phase 3 流程

1. `ConstraintChecker.check(cwd)`
2. `Orchestrator.run(cwd)`
3. 打印每个模块结果
4. 若无 failed 且其余都是 `done/blocked`，推进到 Phase 4

当前实现差距：

- 代码目前只在 Phase 1 和 Phase 3 显式推进阶段
- Phase 2 / 4 / 5 还没有对应的结构化 gate 与状态写回

## `phasegate review <module>`

实现位置：[`src/commands/review.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/commands/review.ts)

职责：

- 对某个模块 task 文档做一次独立 AI 评审

输入上下文：

- `.phasegate/tasks/{module}.md`
- `.phasegate/contracts/*.md`

输出格式由 prompt 约束为：

```md
## Verdict
PASS or FAIL

## Issues
- ...

## Suggestions
- ...
```

## 3. Core 层设计

## `ProgressManager`

实现位置：[`src/core/progress-manager.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/progress-manager.ts)

职责：

- 维护 `progress.json`
- 自动同步 `progress.md`
- 提供阶段和模块状态更新 API

## `AiRunner`

实现位置：[`src/core/ai-runner.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/ai-runner.ts)

职责：

- 统一 `run/fork/chat`
- 支持 `claude/gemini/codex`
- 组装文件上下文

重要细节：

- `claude` 在 `run/fork` 中通过 stdin 传 prompt，规避 Windows 多行转义问题
- `chat` 走交互式子进程，`stdio: inherit`

## `DependencyGraph`

实现位置：[`src/core/dependency-graph.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/dependency-graph.ts)

职责：

- 解析 task 依赖
- 解析 contract frontmatter
- 生成 wave
- 检查循环依赖

## `Orchestrator`

实现位置：[`src/core/orchestrator.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/orchestrator.ts)

职责：

- Phase 3 调度
- 波次并发
- 失败阻断
- 断点恢复
- retry

## `ConstraintChecker`

实现位置：[`src/core/constraint-checker.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/constraint-checker.ts)

职责：

- 为 Phase 3 提供约束检查入口

现状：

- 仍是 stub
- 永远返回通过

## 4. 当前 CLI 层主要问题

### 4.1 Phase 1 目录不一致

`init/review/dependency-graph/orchestrator` 使用的是 `.phasegate/tasks/`，但 `run.ts` 中 `syncPhase1Outputs()` 仍扫描 `.phasegate/design/`。

这是当前最明显的 CLI 与设计脱节点。

### 4.2 阶段结果写回不完整

以下字段已定义但没有稳定写回逻辑：

- `design.reviewPassed`
- `codeReviewPassed`

### 4.3 Phase 2/4/5 仍然偏“薄命令”

这些阶段现在更像：

- 读取 prompt
- 注入少量上下文
- 把结果打印出来

而不是完整的状态机步骤。

## 5. 建议的 CLI 演进方向

1. 统一 `tasks` 目录命名，删除所有旧的 `design/` 引用
2. 为 Phase 2/4/5 增加结构化结果解析
3. 明确每个阶段对 `progress.json` 的写回规则
4. 让 `PhaseExecutor` 可以按阶段补充不同上下文文件，并在跨阶段自动推进时每次都从磁盘重建上下文
5. 把 `ConstraintChecker` 做成真正的 gate
